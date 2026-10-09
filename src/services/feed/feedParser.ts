/**
 * 原生 RSS 2.0 / Atom XML / JSON Feed 解析引擎 (T18)
 * 纯原生实现，零外部依赖，同时兼顾浏览器 DOMParser 与 Node 测试环境兜底
 */

import { ParsedFeedItem } from './types';

/**
 * 清除 HTML 标签与脏字符，提纯出清晰纯文本摘要
 */
export function cleanHtmlText(html: string, maxLength = 140): string {
  if (!html) return '';

  let text = html
    // 移除 script 和 style 块
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // 块级标签替换为空格，避免段落粘连
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, ' ')
    // 剥除所有剩余 HTML 标签
    .replace(/<[^>]+>/g, '')
    // 还原常见 HTML 实体
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    // 压缩连续空白与换行
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }
  return text;
}

/**
 * 人性化相对时间计算
 */
export function formatRelativeTime(dateInput?: string | number | Date): { formatted: string; timestamp: number } {
  if (!dateInput) {
    return { formatted: '近期', timestamp: Date.now() };
  }

  const d = new Date(dateInput);
  const timestamp = isNaN(d.getTime()) ? Date.now() : d.getTime();
  const diffMs = Date.now() - timestamp;

  if (diffMs < 0 || diffMs < 60 * 1000) {
    return { formatted: '刚刚', timestamp };
  }
  if (diffMs < 60 * 60 * 1000) {
    return { formatted: `${Math.floor(diffMs / (60 * 1000))} 分钟前`, timestamp };
  }
  if (diffMs < 24 * 60 * 60 * 1000) {
    return { formatted: `${Math.floor(diffMs / (60 * 60 * 1000))} 小时前`, timestamp };
  }
  if (diffMs < 48 * 60 * 60 * 1000) {
    return { formatted: '昨天', timestamp };
  }
  if (diffMs < 7 * 24 * 60 * 60 * 1000) {
    return { formatted: `${Math.floor(diffMs / (24 * 60 * 60 * 1000))} 天前`, timestamp };
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { formatted: `${year}-${month}-${day}`, timestamp };
}

/**
 * 解析 JSON Feed 标准数据 (https://jsonfeed.org/version/1.1)
 */
export function parseJsonFeed(jsonText: string): ParsedFeedItem[] {
  try {
    const data = JSON.parse(jsonText);
    if (!data || !Array.isArray(data.items)) return [];

    return data.items.map((item: any) => ({
      id: String(item.id || item.url || ''),
      title: cleanHtmlText(item.title || '无标题', 100),
      link: item.url || item.external_url || '',
      pubDate: item.date_published || item.date_modified,
      summary: cleanHtmlText(item.summary || item.content_text || item.content_html || '', 140),
      author: item.author?.name || item.authors?.[0]?.name,
    }));
  } catch {
    return [];
  }
}

/**
 * 从 XML 片段中使用正则安全提取文本内容 (兼容 Node.js 与 DOMParser)
 */
function extractTagContent(xmlChunk: string, tagName: string): string {
  // 兼容命名空间标签如 content:encoded
  const escaped = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const match = xmlChunk.match(regex);
  if (!match) return '';

  let content = match[1];
  // 提取 CDATA 块
  const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  return content.trim();
}

/**
 * 解析 RSS 2.0 / 1.0 XML 数据
 */
export function parseRssXml(xmlText: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const itemNodes = doc.querySelectorAll('item');

      itemNodes.forEach((node) => {
        const title = node.querySelector('title')?.textContent || '无标题';
        const link = node.querySelector('link')?.textContent || '';
        const guid = node.querySelector('guid')?.textContent || link;
        const pubDate = node.querySelector('pubDate')?.textContent || '';
        // 优先提取 content:encoded，其次 description
        const content =
          node.getElementsByTagName('content:encoded')[0]?.textContent ||
          node.querySelector('description')?.textContent ||
          '';

        items.push({
          id: guid || link,
          title: cleanHtmlText(title, 100),
          link: link.trim(),
          pubDate: pubDate.trim(),
          summary: cleanHtmlText(content, 140),
        });
      });

      if (items.length > 0) return items;
    } catch {
      // DOMParser 异常时降级至正则解析器
    }
  }

  // 正则兜底解析器 (适用于纯 Node 环境与破损 XML)
  const itemMatches = xmlText.match(/<item[\s>]([\s\S]*?)<\/item>/gi) || [];
  for (const itemXml of itemMatches) {
    const title = extractTagContent(itemXml, 'title') || '无标题';
    const link = extractTagContent(itemXml, 'link');
    const guid = extractTagContent(itemXml, 'guid') || link;
    const pubDate = extractTagContent(itemXml, 'pubDate');
    const content =
      extractTagContent(itemXml, 'content:encoded') ||
      extractTagContent(itemXml, 'description') ||
      '';

    items.push({
      id: guid || link,
      title: cleanHtmlText(title, 100),
      link: link.trim(),
      pubDate: pubDate.trim(),
      summary: cleanHtmlText(content, 140),
    });
  }

  return items;
}

/**
 * 解析 Atom XML 数据
 */
export function parseAtomXml(xmlText: string): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const entryNodes = doc.querySelectorAll('entry');

      entryNodes.forEach((node) => {
        const title = node.querySelector('title')?.textContent || '无标题';
        const linkNode = node.querySelector('link[rel="alternate"]') || node.querySelector('link');
        const link = linkNode?.getAttribute('href') || linkNode?.textContent || '';
        const id = node.querySelector('id')?.textContent || link;
        const pubDate =
          node.querySelector('published')?.textContent ||
          node.querySelector('updated')?.textContent ||
          '';
        const summary =
          node.querySelector('summary')?.textContent ||
          node.querySelector('content')?.textContent ||
          '';

        items.push({
          id: id || link,
          title: cleanHtmlText(title, 100),
          link: link.trim(),
          pubDate: pubDate.trim(),
          summary: cleanHtmlText(summary, 140),
        });
      });

      if (items.length > 0) return items;
    } catch {
      // 降级至正则
    }
  }

  // 正则兜底解析器
  const entryMatches = xmlText.match(/<entry[\s>]([\s\S]*?)<\/entry>/gi) || [];
  for (const entryXml of entryMatches) {
    const title = extractTagContent(entryXml, 'title') || '无标题';
    let link = '';
    const hrefMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    if (hrefMatch) {
      link = hrefMatch[1];
    } else {
      link = extractTagContent(entryXml, 'link');
    }

    const id = extractTagContent(entryXml, 'id') || link;
    const pubDate =
      extractTagContent(entryXml, 'published') ||
      extractTagContent(entryXml, 'updated') ||
      '';
    const summary =
      extractTagContent(entryXml, 'summary') ||
      extractTagContent(entryXml, 'content') ||
      '';

    items.push({
      id: id || link,
      title: cleanHtmlText(title, 100),
      link: link.trim(),
      pubDate: pubDate.trim(),
      summary: cleanHtmlText(summary, 140),
    });
  }

  return items;
}

/**
 * 统合智能解析入口：自动识别 JSON Feed、Atom 或 RSS 2.0 并输出标准数据
 */
export function parseFeed(rawText: string, forcedType?: 'auto' | 'rss' | 'atom' | 'json'): ParsedFeedItem[] {
  const text = (rawText || '').trim();
  if (!text) return [];

  // 1. JSON Feed 判定
  if (forcedType === 'json' || (text.startsWith('{') && text.includes('"items"'))) {
    return parseJsonFeed(text);
  }

  // 2. Atom XML 判定
  if (forcedType === 'atom' || text.includes('<feed') || text.includes('xmlns="http://www.w3.org/2005/Atom"')) {
    return parseAtomXml(text);
  }

  // 3. RSS 2.0 / 1.0 判定
  if (forcedType === 'rss' || text.includes('<rss') || text.includes('<channel')) {
    return parseRssXml(text);
  }

  // 4. 混合/宽容探测：依次尝试 RSS -> Atom -> JSON
  const rssRes = parseRssXml(text);
  if (rssRes.length > 0) return rssRes;

  const atomRes = parseAtomXml(text);
  if (atomRes.length > 0) return atomRes;

  return parseJsonFeed(text);
}
