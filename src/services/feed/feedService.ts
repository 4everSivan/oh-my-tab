/**
 * 订阅消息核心服务 (T18 - ExtensionDataSources)
 * 调度网络请求、解析引擎、缓存持久化、增量合并与阅读状态
 */

import { FeedSource, FeedItem, ParsedFeedItem } from './types';
import { DEFAULT_FEED_SOURCES } from './defaultSources';
import { parseFeed, formatRelativeTime } from './feedParser';
import { executeScriptTransform } from './scriptExecutor';
import { exportSourcesToOpml, parseOpml, convertOutlineToFeedSource } from './opmlService';

const STORAGE_KEYS = {
  SOURCES: 'oh_my_tab_feed_sources',
  CACHE: 'oh_my_tab_feed_cache',
  LAST_FETCH_TIME: 'oh_my_tab_feed_last_fetch',
};

class FeedService {
  private sourcesCache: FeedSource[] | null = null;
  private itemsCache: FeedItem[] | null = null;

  /**
   * 获取所有订阅源配置
   */
  async getSources(): Promise<FeedSource[]> {
    if (this.sourcesCache) return this.sourcesCache;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SOURCES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.sourcesCache = parsed;
          return parsed;
        }
      }
    } catch {
      // 容错降级
    }

    this.sourcesCache = [...DEFAULT_FEED_SOURCES];
    this.saveSources(this.sourcesCache);
    return this.sourcesCache;
  }

  /**
   * 保存订阅源配置
   */
  async saveSources(sources: FeedSource[]): Promise<void> {
    this.sourcesCache = sources;
    try {
      localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));
    } catch (e) {
      console.warn('[FeedService] 写入 sources 失败', e);
    }
  }

  /**
   * 添加新订阅源
   */
  async addSource(source: Omit<FeedSource, 'id'>): Promise<FeedSource> {
    const sources = await this.getSources();
    const newSource: FeedSource = {
      ...source,
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    const updated = [newSource, ...sources];
    await this.saveSources(updated);
    return newSource;
  }

  /**
   * 更新订阅源
   */
  async updateSource(id: string, updates: Partial<FeedSource>): Promise<void> {
    const sources = await this.getSources();
    const updated = sources.map((s) => (s.id === id ? { ...s, ...updates } : s));
    await this.saveSources(updated);
  }

  /**
   * 移除订阅源
   */
  async deleteSource(id: string): Promise<void> {
    const sources = await this.getSources();
    const updated = sources.filter((s) => s.id !== id);
    await this.saveSources(updated);

    // 同步移除该源的文章缓存
    const cached = await this.getCachedFeeds();
    const filteredFeeds = cached.filter((f) => f.sourceId !== id);
    await this.saveCachedFeeds(filteredFeeds);
  }

  /**
   * 切换源启用状态
   */
  async toggleSource(id: string, enabled: boolean): Promise<void> {
    await this.updateSource(id, { enabled });
  }

  /**
   * 重置恢复为默认精选源
   */
  async resetToDefaultSources(): Promise<FeedSource[]> {
    this.sourcesCache = [...DEFAULT_FEED_SOURCES];
    await this.saveSources(this.sourcesCache);
    return this.sourcesCache;
  }

  /**
   * 获取本地文章缓存
   */
  async getCachedFeeds(): Promise<FeedItem[]> {
    if (this.itemsCache) return this.itemsCache;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.itemsCache = parsed;
          return parsed;
        }
      }
    } catch {
      // 容错
    }

    this.itemsCache = [];
    return [];
  }

  /**
   * 保存本地文章缓存 (至多保留 150 条)
   */
  async saveCachedFeeds(items: FeedItem[]): Promise<void> {
    this.itemsCache = items.slice(0, 150);
    try {
      localStorage.setItem(STORAGE_KEYS.CACHE, JSON.stringify(this.itemsCache));
    } catch (e) {
      console.warn('[FeedService] 写入文章缓存失败', e);
    }
  }

  /**
   * 发起跨域或网络抓取请求
   */
  async fetchUrlText(url: string, timeoutMs = 15000): Promise<string> {
    const isExtension = typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);

    // 1. Chrome 扩展环境：通过 Background Service Worker 代理 (零 CORS 限制)
    if (isExtension && chrome.runtime?.sendMessage) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response: any = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'FETCH_FEED', url, timeoutMs }, (res) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(res);
              }
            });
          });

          if (response?.success && typeof response.text === 'string') {
            return response.text;
          }
          if (response?.error) {
            console.warn(`[feedService] 后台代理抓取未成功 (${url}):`, response.error);
          }
        } catch {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      }

      // 注意：在 Chrome 扩展页面环境下，严禁直接对无 CORS 头的第三方 URL 执行前端直连 fetch(url)！
      // 否则浏览器控制台必产生红色 Access-Control-Allow-Origin 策略拦截报错。
      // 后台直连若未响应，前端直接调用公网 HTTPS 只读代理兜底：
      try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          return await res.text();
        }
      } catch {
        // 代理兜底亦失败
      }

      throw new Error(`无法连接至订阅源 (${url})，请检查网络或在 chrome://extensions 重新加载扩展`);
    }

    // 2. 非扩展环境（如纯本地 Web 开发服务器 localhost:5173）：
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // 直连失败
    }

    // 3. Web 模式公共只读代理兜底 (保障开发与单机模式可用)
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // 最终失败
    }

    throw new Error(`无法连接至订阅源: ${url}`);
  }

  /**
   * 单源拉取与解析
   */
  async fetchSingleSource(source: FeedSource): Promise<ParsedFeedItem[]> {
    const rawText = await this.fetchUrlText(source.url);

    if (source.type === 'script') {
      const script = source.scriptConfig?.transformScript || '';
      const execResult = await executeScriptTransform(script, rawText, source.url);
      if (!execResult.success) {
        throw new Error(execResult.error || '脚本解析未返回有效条目');
      }
      return execResult.items;
    }

    const parsed = parseFeed(rawText, source.type);
    if (parsed.length === 0) {
      throw new Error('未解析到有效文章条目 (可能非标准 RSS/Atom 格式)');
    }
    return parsed;
  }

  /**
   * 并发拉取所有启用的订阅源，执行增量合并与去重
   */
  async refreshAllFeeds(_force = false): Promise<{ feeds: FeedItem[]; errors: Record<string, string> }> {
    const sources = await this.getSources();
    const enabledSources = sources.filter((s) => s.enabled);
    const cachedItems = await this.getCachedFeeds();

    // 建立现有已读状态映射表
    const readMap = new Map<string, boolean>();
    cachedItems.forEach((item) => {
      readMap.set(item.id, item.read);
    });

    const errors: Record<string, string> = {};
    const newItemsFromAllSources: FeedItem[] = [];
    const now = Date.now();

    await Promise.allSettled(
      enabledSources.map(async (source) => {
        try {
          const parsed = await this.fetchSingleSource(source);
          source.lastFetchedAt = now;
          source.lastError = undefined;
          source.itemCount = parsed.length;

          parsed.forEach((p, idx) => {
            const timeInfo = formatRelativeTime(p.pubDate);
            const itemId = `${source.id}-${p.id || p.link || idx}`;
            const isRead = readMap.get(itemId) ?? false;

            newItemsFromAllSources.push({
              id: itemId,
              sourceId: source.id,
              sourceTitle: source.name,
              category: source.category,
              categoryName: source.categoryName || '资讯',
              tagClass: source.category,
              title: p.title,
              time: timeInfo.formatted,
              timestamp: timeInfo.timestamp,
              summary: p.summary || '点击进入阅读原文...',
              url: p.link || '#',
              read: isRead,
            });
          });
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          source.lastError = errMsg;
          errors[source.id] = errMsg;
        }
      })
    );

    // 更新源状态
    await this.saveSources(sources);

    // 将已有条目与新拉取条目去重合并 (按 URL 或 ID)
    const uniqueMap = new Map<string, FeedItem>();
    newItemsFromAllSources.forEach((item) => {
      uniqueMap.set(item.id, item);
    });
    // 保留未被本次覆盖的历史条目
    cachedItems.forEach((item) => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    // 按时间倒序排序
    const sortedFeeds = Array.from(uniqueMap.values()).sort(
      (a, b) => b.timestamp - a.timestamp
    );

    await this.saveCachedFeeds(sortedFeeds);
    return { feeds: sortedFeeds, errors };
  }

  /**
   * 切换文章已读状态
   */
  async toggleRead(id: string): Promise<FeedItem[]> {
    const cached = await this.getCachedFeeds();
    const updated = cached.map((f) => (f.id === id ? { ...f, read: !f.read } : f));
    await this.saveCachedFeeds(updated);
    return updated;
  }

  /**
   * 全部标为已读
   */
  async markAllRead(): Promise<FeedItem[]> {
    const cached = await this.getCachedFeeds();
    const updated = cached.map((f) => ({ ...f, read: true }));
    await this.saveCachedFeeds(updated);
    return updated;
  }

  /**
   * 导入 OPML 订阅单
   */
  async importOpml(xmlText: string): Promise<{ added: number; sources: FeedSource[] }> {
    const outlines = parseOpml(xmlText);
    if (outlines.length === 0) {
      throw new Error('未在文件中识别到有效的 RSS 订阅节点');
    }

    const currentSources = await this.getSources();
    const existingUrls = new Set(currentSources.map((s) => s.url.toLowerCase().trim()));

    const newSources: FeedSource[] = [];
    outlines.forEach((o) => {
      if (!existingUrls.has(o.xmlUrl.toLowerCase().trim())) {
        newSources.push(convertOutlineToFeedSource(o));
        existingUrls.add(o.xmlUrl.toLowerCase().trim());
      }
    });

    const merged = [...newSources, ...currentSources];
    await this.saveSources(merged);
    return { added: newSources.length, sources: merged };
  }

  /**
   * 导出为 OPML 字符串
   */
  async exportOpml(): Promise<string> {
    const sources = await this.getSources();
    return exportSourcesToOpml(sources);
  }
}

export const feedService = new FeedService();
