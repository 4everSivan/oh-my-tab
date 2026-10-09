/**
 * 标准 OPML 订阅单导入与导出服务 (T18)
 * 支持与 Inoreader、Feedly、NetNewsWire 等主流 RSS 阅读器无缝互通
 */

import { FeedSource, OpmlOutline } from './types';

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 将当前订阅源列表导出为标准 OPML 2.0 格式 XML
 */
export function exportSourcesToOpml(sources: FeedSource[]): string {
  const outlines = sources
    .filter((s) => s.type !== 'script') // 纯脚本源不具备标准 xmlUrl
    .map((s) => {
      const title = escapeXml(s.name);
      const xmlUrl = escapeXml(s.url);
      const category = escapeXml(s.categoryName || s.category || '未分类');
      return `    <outline text="${title}" title="${title}" type="rss" xmlUrl="${xmlUrl}" category="${category}" />`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>oh-my-tab 订阅源导出</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
    <docs>http://opml.org/spec2.opml</docs>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}

/**
 * 解析 OPML XML 文本并提取所有有效订阅节点
 */
export function parseOpml(xmlText: string): OpmlOutline[] {
  const outlines: OpmlOutline[] = [];
  if (!xmlText || !xmlText.trim()) return [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const nodes = doc.querySelectorAll('outline[xmlUrl]');

      nodes.forEach((node) => {
        const xmlUrl = node.getAttribute('xmlUrl') || '';
        if (xmlUrl) {
          const text = node.getAttribute('text') || node.getAttribute('title') || '未命名订阅';
          const title = node.getAttribute('title') || text;
          const htmlUrl = node.getAttribute('htmlUrl') || '';
          const category =
            node.getAttribute('category') ||
            node.parentElement?.getAttribute('text') ||
            node.parentElement?.getAttribute('title') ||
            '未分类';

          outlines.push({
            text: text.trim(),
            title: title.trim(),
            xmlUrl: xmlUrl.trim(),
            htmlUrl: htmlUrl.trim(),
            category: category.trim(),
          });
        }
      });

      if (outlines.length > 0) return outlines;
    } catch {
      // 降级至正则
    }
  }

  // 正则兜底解析
  const matches = xmlText.match(/<outline[^>]+xmlUrl=["'][^"']+["'][^>]*>/gi) || [];
  for (const tag of matches) {
    const xmlUrlMatch = tag.match(/xmlUrl=["']([^"']+)["']/i);
    if (!xmlUrlMatch) continue;

    const xmlUrl = xmlUrlMatch[1];
    const textMatch = tag.match(/text=["']([^"']+)["']/i);
    const titleMatch = tag.match(/title=["']([^"']+)["']/i);
    const htmlUrlMatch = tag.match(/htmlUrl=["']([^"']+)["']/i);
    const catMatch = tag.match(/category=["']([^"']+)["']/i);

    const title = titleMatch ? titleMatch[1] : textMatch ? textMatch[1] : '未命名订阅';
    outlines.push({
      text: title,
      title: title,
      xmlUrl: xmlUrl.trim(),
      htmlUrl: htmlUrlMatch ? htmlUrlMatch[1] : undefined,
      category: catMatch ? catMatch[1] : '未分类',
    });
  }

  return outlines;
}

/**
 * 将 OPML Outline 转换为系统标准 FeedSource
 */
export function convertOutlineToFeedSource(outline: OpmlOutline): FeedSource {
  return {
    id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: outline.title || outline.text,
    url: outline.xmlUrl,
    type: 'rss',
    category: outline.category || 'tech',
    categoryName: outline.category || '导入源',
    enabled: true,
    refreshIntervalMinutes: 30,
  };
}
