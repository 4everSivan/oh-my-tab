/**
 * 订阅消息核心服务 (T18 - ExtensionDataSources)
 * 调度网络请求、解析引擎、缓存持久化、增量合并与阅读状态
 */

import { FeedSource, FeedItem, ParsedFeedItem } from './types';
import { DEFAULT_FEED_SOURCES } from './defaultSources';
import { parseFeed, formatRelativeTime } from './feedParser';
import { executeScriptTransform } from './scriptExecutor';
import { exportSourcesToOpml, parseOpml, convertOutlineToFeedSource } from './opmlService';

/**
 * 规范化 Feed URL：协议与域名小写，保留路径与查询参数的原始大小写
 */
export function normalizeFeedUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl.trim();
  }
}

const STORAGE_KEYS = {
  SOURCES: 'oh_my_tab_feed_sources',
  CACHE: 'oh_my_tab_feed_cache',
  LAST_FETCH_TIME: 'oh_my_tab_feed_last_fetch',
};

class FeedService {
  private sourcesCache: FeedSource[] | null = null;
  private itemsCache: FeedItem[] | null = null;
  private refreshGeneration = 0;

  /**
   * 获取所有订阅源配置
   */
  async getSources(): Promise<FeedSource[]> {
    if (this.sourcesCache) return this.sourcesCache;

    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SOURCES);
      // N16: 只有键不存在 (raw === null) 时才回退默认源；raw 为合法空数组 [] 时保留空源
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
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
          const response = await new Promise<{ success?: boolean; text?: string; error?: string } | undefined>(
            (resolve, reject) => {
              const timer = setTimeout(() => {
                reject(new Error(`请求订阅源超时 (${timeoutMs}ms)`));
              }, timeoutMs + 1000);

              chrome.runtime.sendMessage({ type: 'FETCH_FEED', url, timeoutMs }, (res) => {
                clearTimeout(timer);
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(res);
                }
              });
            }
          );

          if (response?.success && typeof response.text === 'string') {
            return response.text;
          }
          if (response?.error) {
            console.warn(`[feedService] 后台代理抓取未成功 (${url}):`, response.error);
            throw new Error(response.error);
          }
        } catch (err: unknown) {
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 200));
          } else {
            throw err;
          }
        }
      }

      throw new Error(`无法连接至订阅源 (${url})，请检查网络或订阅地址`);
    }

    // 2. 非扩展环境（如纯本地 Web 开发服务器 localhost:5173）：
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.text();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`无法连接至订阅源 (${url}): ${msg}`);
    } finally {
      clearTimeout(timer);
    }
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
   * 并发拉取所有启用的订阅源，执行增量合并与去重 (防 N03、N04、N16)
   */
  async refreshAllFeeds(_force = false): Promise<{ feeds: FeedItem[]; errors: Record<string, string> }> {
    const generation = ++this.refreshGeneration;
    const initialSources = await this.getSources();
    const enabledSources = initialSources.filter((s) => s.enabled);

    const errors: Record<string, string> = {};
    const newItemsFromAllSources: FeedItem[] = [];
    const now = Date.now();
    const fetchMetadataMap = new Map<string, { lastFetchedAt: number; itemCount: number; lastError?: string }>();

    await Promise.allSettled(
      enabledSources.map(async (source) => {
        try {
          const parsed = await this.fetchSingleSource(source);
          fetchMetadataMap.set(source.id, {
            lastFetchedAt: now,
            itemCount: parsed.length,
            lastError: undefined,
          });

          parsed.forEach((p, idx) => {
            const timeInfo = formatRelativeTime(p.pubDate);
            const itemId = `${source.id}-${p.id || p.link || idx}`;

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
              read: false, // 稍后与提交时的最新 readMap 合并
            });
          });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          fetchMetadataMap.set(source.id, {
            lastFetchedAt: now,
            itemCount: 0,
            lastError: errMsg,
          });
          errors[source.id] = errMsg;
        }
      })
    );

    // 1. 获取最新的源配置 (防 N03: 刷新期间用户删除源或新增源)
    const latestSources = await this.getSources();
    const validSourceIds = new Set(latestSources.map((s) => s.id));

    // 仅在当前代次有效时增量写回源元数据，绝不整体覆写旧 sources 数组
    if (generation === this.refreshGeneration) {
      const updatedSources = latestSources.map((source) => {
        const meta = fetchMetadataMap.get(source.id);
        if (!meta) return source;
        return {
          ...source,
          lastFetchedAt: meta.lastFetchedAt,
          itemCount: meta.itemCount,
          lastError: meta.lastError,
        };
      });
      await this.saveSources(updatedSources);
    }

    // 2. 重新获取最新的文章缓存与已读状态 (防 N04: 刷新期间标记已读被回滚)
    const latestCachedItems = await this.getCachedFeeds();
    const latestReadMap = new Map<string, boolean>();
    latestCachedItems.forEach((item) => {
      latestReadMap.set(item.id, item.read);
    });

    // 3. 过滤并合并文章：只保留属于最新有效订阅源 (validSourceIds) 的条目
    const uniqueMap = new Map<string, FeedItem>();
    newItemsFromAllSources.forEach((item) => {
      if (validSourceIds.has(item.sourceId)) {
        // 继承最新已读状态
        item.read = latestReadMap.get(item.id) ?? false;
        uniqueMap.set(item.id, item);
      }
    });

    // 4. 保留未被本次覆盖的历史条目 (同样过滤已删除源)
    latestCachedItems.forEach((item) => {
      if (validSourceIds.has(item.sourceId) && !uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    // 5. 按时间倒序排序并截断至 150 条 (防 N16: 统一返回与保存的集合)
    const sortedFeeds = Array.from(uniqueMap.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 150);

    await this.saveCachedFeeds(sortedFeeds);
    return { feeds: sortedFeeds, errors };
  }

  /**
   * 标记指定文章为已读 (幂等：已读时不触发冗余存储写入与广播，防 N16)
   */
  async markItemRead(id: string): Promise<FeedItem[]> {
    const cached = await this.getCachedFeeds();
    const target = cached.find((f) => f.id === id);
    if (!target || target.read) {
      return cached;
    }
    const updated = cached.map((f) => (f.id === id ? { ...f, read: true } : f));
    await this.saveCachedFeeds(updated);
    return updated;
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
   * 导入 OPML 订阅单 (使用 normalizeFeedUrl 避免破坏大小写敏感路径，防 N16)
   */
  async importOpml(xmlText: string): Promise<{ added: number; sources: FeedSource[] }> {
    const outlines = parseOpml(xmlText);
    if (outlines.length === 0) {
      throw new Error('未在文件中识别到有效的 RSS 订阅节点');
    }

    const currentSources = await this.getSources();
    const existingUrls = new Set(currentSources.map((s) => normalizeFeedUrl(s.url)));

    const newSources: FeedSource[] = [];
    outlines.forEach((o) => {
      const norm = normalizeFeedUrl(o.xmlUrl);
      if (!existingUrls.has(norm)) {
        newSources.push(convertOutlineToFeedSource(o));
        existingUrls.add(norm);
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
