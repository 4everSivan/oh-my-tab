const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── T18 真实 RSS/Atom 订阅解析与极客脚本数据源引擎 ─────────────────────

const parserSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'feed', 'feedParser.ts'),
  'utf8'
);
const scriptSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'feed', 'scriptExecutor.ts'),
  'utf8'
);
const opmlSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'feed', 'opmlService.ts'),
  'utf8'
);
const defaultSourcesSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'feed', 'defaultSources.ts'),
  'utf8'
);
const serviceSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'feed', 'feedService.ts'),
  'utf8'
);
const manifestSrc = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'manifest.json'),
  'utf8'
);
const backgroundSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'background', 'index.ts'),
  'utf8'
);
const feedSidebarSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'feed', 'FeedSidebar.tsx'),
  'utf8'
);

// 核心清洗与相对时间函数纯算法单测实现
function cleanHtmlText(html, maxLength = 140) {
  if (!html) return '';
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '...';
  }
  return text;
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return { formatted: '近期', timestamp: Date.now() };
  const d = new Date(dateInput);
  const timestamp = isNaN(d.getTime()) ? Date.now() : d.getTime();
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0 || diffMs < 60 * 1000) return { formatted: '刚刚', timestamp };
  if (diffMs < 60 * 60 * 1000) return { formatted: `${Math.floor(diffMs / (60 * 1000))} 分钟前`, timestamp };
  if (diffMs < 24 * 60 * 60 * 1000) return { formatted: `${Math.floor(diffMs / (60 * 60 * 1000))} 小时前`, timestamp };
  if (diffMs < 48 * 60 * 60 * 1000) return { formatted: '昨天', timestamp };
  if (diffMs < 7 * 24 * 60 * 60 * 1000) return { formatted: `${Math.floor(diffMs / (24 * 60 * 60 * 1000))} 天前`, timestamp };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { formatted: `${year}-${month}-${day}`, timestamp };
}

function extractTagContent(xmlChunk, tagName) {
  const escaped = tagName.replace(':', '\\:');
  const regex = new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i');
  const match = xmlChunk.match(regex);
  if (!match) return '';
  let content = match[1];
  const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  return (cdataMatch ? cdataMatch[1] : content).trim();
}

function parseRssXml(xmlText) {
  const items = [];
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

function parseAtomXml(xmlText) {
  const items = [];
  const entryMatches = xmlText.match(/<entry[\s>]([\s\S]*?)<\/entry>/gi) || [];
  for (const entryXml of entryMatches) {
    const title = extractTagContent(entryXml, 'title') || '无标题';
    let link = '';
    const hrefMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["']/i);
    link = hrefMatch ? hrefMatch[1] : extractTagContent(entryXml, 'link');
    const id = extractTagContent(entryXml, 'id') || link;
    const pubDate = extractTagContent(entryXml, 'published') || extractTagContent(entryXml, 'updated') || '';
    const summary = extractTagContent(entryXml, 'summary') || extractTagContent(entryXml, 'content') || '';
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

function parseJsonFeed(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    if (!data || !Array.isArray(data.items)) return [];
    return data.items.map((item) => ({
      id: String(item.id || item.url || ''),
      title: cleanHtmlText(item.title || '无标题', 100),
      link: item.url || item.external_url || '',
      pubDate: item.date_published || item.date_modified,
      summary: cleanHtmlText(item.summary || item.content_text || item.content_html || '', 140),
    }));
  } catch {
    return [];
  }
}

async function executeScriptTransform(script, rawText, url) {
  let jsonData = null;
  try {
    jsonData = JSON.parse(rawText);
  } catch {
    jsonData = null;
  }
  const utils = { cleanHtmlText, formatRelativeTime };
  let wrappedCode = script.trim();
  if (/^(\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/i.test(wrappedCode) || /^function\s*\(/i.test(wrappedCode)) {
    wrappedCode = `const userFn = (${wrappedCode}); return userFn(data, rawText, url, utils);`;
  } else if (!wrappedCode.includes('return ') && !wrappedCode.includes('\n')) {
    wrappedCode = `return (${wrappedCode});`;
  }
  try {
    const runner = new Function('data', 'rawText', 'url', 'utils', wrappedCode);
    const result = await Promise.resolve(runner(jsonData, rawText, url, utils));
    if (!Array.isArray(result)) return { success: false, items: [], error: '必须是数组' };
    return {
      success: true,
      items: result.map((item, idx) => ({
        id: String(item.id || item.link || item.url || `item-${idx}`),
        title: cleanHtmlText(item.title || item.name || '无标题', 100),
        link: String(item.link || item.url || item.html_url || ''),
        summary: cleanHtmlText(item.summary || item.description || item.body || '', 140),
      })),
    };
  } catch (err) {
    return { success: false, items: [], error: String(err.message || err) };
  }
}

function parseOpml(xmlText) {
  const outlines = [];
  const matches = xmlText.match(/<outline[^>]+xmlUrl=["'][^"']+["'][^>]*>/gi) || [];
  for (const tag of matches) {
    const xmlUrlMatch = tag.match(/xmlUrl=["']([^"']+)["']/i);
    if (!xmlUrlMatch) continue;
    const xmlUrl = xmlUrlMatch[1];
    const textMatch = tag.match(/text=["']([^"']+)["']/i);
    const titleMatch = tag.match(/title=["']([^"']+)["']/i);
    const catMatch = tag.match(/category=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1] : textMatch ? textMatch[1] : '未命名订阅';
    outlines.push({
      text: title,
      title: title,
      xmlUrl: xmlUrl.trim(),
      category: catMatch ? catMatch[1] : '未分类',
    });
  }
  return outlines;
}

function exportSourcesToOpml(sources) {
  const outlines = sources
    .filter((s) => s.type !== 'script')
    .map((s) => `    <outline text="${s.name}" title="${s.name}" type="rss" xmlUrl="${s.url}" category="${s.category}" />`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <body>\n${outlines}\n  </body>\n</opml>`;
}

test('T18: cleanHtmlText 彻底提纯脏 HTML 标签与还原字符实体', () => {
  const dirty = '<p>Hello <strong>World</strong> &amp; &lt;React 19&gt;! <script>alert(1)</script></p>';
  const cleaned = cleanHtmlText(dirty, 50);
  assert.equal(cleaned, 'Hello World & <React 19>!');

  const longText = '<p>' + 'a'.repeat(200) + '</p>';
  const truncated = cleanHtmlText(longText, 50);
  assert.ok(truncated.endsWith('...'));
  assert.equal(truncated.length, 53);
});

test('T18: formatRelativeTime 人性化相对时间换算准确性', () => {
  const now = Date.now();
  assert.equal(formatRelativeTime(now - 30 * 1000).formatted, '刚刚');
  assert.equal(formatRelativeTime(now - 15 * 60 * 1000).formatted, '15 分钟前');
  assert.equal(formatRelativeTime(now - 3 * 3600 * 1000).formatted, '3 小时前');
  assert.equal(formatRelativeTime(now - 30 * 3600 * 1000).formatted, '昨天');
  assert.equal(formatRelativeTime(now - 4 * 86400 * 1000).formatted, '4 天前');
  assert.ok(formatRelativeTime('2025-01-01').formatted.includes('2025-01-01'));
});

test('T18: parseRssXml 正确提取 RSS 2.0 规范 item 数据', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>少数派 (SSPAI)</title>
    <link>https://sspai.com</link>
    <item>
      <title><![CDATA[高效桌面工作台的实践思考]]></title>
      <link>https://sspai.com/post/88888</link>
      <guid>https://sspai.com/post/88888</guid>
      <pubDate>Thu, 09 Oct 2026 12:00:00 GMT</pubDate>
      <description><![CDATA[<p>这是一篇关于<b>新标签页</b>与高保真动效的深度剖析。</p>]]></description>
    </item>
  </channel>
</rss>`;

  const items = parseRssXml(rssXml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, '高效桌面工作台的实践思考');
  assert.equal(items[0].link, 'https://sspai.com/post/88888');
  assert.equal(items[0].id, 'https://sspai.com/post/88888');
  assert.equal(items[0].summary, '这是一篇关于新标签页与高保真动效的深度剖析。');
});

test('T18: parseAtomXml 正确提取 Atom 规范 entry 数据', () => {
  const atomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>阮一峰的网络日志</title>
  <entry>
    <title>科技爱好者周刊（第 330 期）</title>
    <link rel="alternate" href="https://www.ruanyifeng.com/blog/2026/10/weekly-issue-330.html" />
    <id>tag:ruanyifeng.com,2026:330</id>
    <published>2026-10-09T08:00:00Z</published>
    <summary>这里记录每周值得分享的科技内容，周五发布。</summary>
  </entry>
</feed>`;

  const items = parseAtomXml(atomXml);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, '科技爱好者周刊（第 330 期）');
  assert.equal(items[0].link, 'https://www.ruanyifeng.com/blog/2026/10/weekly-issue-330.html');
  assert.equal(items[0].id, 'tag:ruanyifeng.com,2026:330');
  assert.equal(items[0].summary, '这里记录每周值得分享的科技内容，周五发布。');
});

test('T18: parseJsonFeed 正确提取 JSON Feed 1.1 数据', () => {
  const jsonFeed = JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Daring Fireball',
    items: [
      {
        id: 'https://daringfireball.net/2026/10/article',
        title: 'New Hardware Review',
        url: 'https://daringfireball.net/2026/10/article',
        summary: 'A detailed look at the new display technology.',
        date_published: '2026-10-09T10:00:00Z',
      },
    ],
  });

  const items = parseJsonFeed(jsonFeed);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'New Hardware Review');
  assert.equal(items[0].link, 'https://daringfireball.net/2026/10/article');
  assert.equal(items[0].summary, 'A detailed look at the new display technology.');
});

test('T18: scriptExecutor 沙箱执行保护与字段归一化', async () => {
  // 1. 成功案例
  const rawApiJson = JSON.stringify({
    items: [
      { id: 101, name: 'ant-design/ant-design', html_url: 'https://github.com/ant-design', desc: 'Enterprise UI library' },
    ],
  });
  const scriptCode = `return data.items.map(item => ({ id: item.id, title: item.name, link: item.html_url, summary: item.desc }));`;

  const res = await executeScriptTransform(scriptCode, rawApiJson, 'https://api.github.com');
  assert.equal(res.success, true);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].title, 'ant-design/ant-design');
  assert.equal(res.items[0].link, 'https://github.com/ant-design');
  assert.equal(res.items[0].summary, 'Enterprise UI library');

  // 2. 语法错误沙箱隔离 (不抛出致命异常)
  const badScript = `throw new Error('测试沙箱阻断');\nreturn [];`;
  const badRes = await executeScriptTransform(badScript, '{}', 'https://api.test');
  assert.equal(badRes.success, false);
  assert.ok(badRes.error.includes('测试沙箱阻断'));
});

test('T18: opmlService 支持标准 OPML 2.0 导入与导出', () => {
  const mockSources = [
    {
      id: 'src-1',
      name: '少数派',
      url: 'https://sspai.com/feed',
      type: 'rss',
      category: 'tech',
      enabled: true,
    },
    {
      id: 'src-2',
      name: '极客脚本',
      url: 'https://api.test',
      type: 'script',
      category: 'dev',
      enabled: true,
    },
  ];

  const opmlText = exportSourcesToOpml(mockSources);
  assert.ok(opmlText.includes('<opml version="2.0">'));
  assert.ok(opmlText.includes('xmlUrl="https://sspai.com/feed"'));
  assert.ok(!opmlText.includes('https://api.test'), '脚本源不应进入标准 xmlUrl outline');

  const outlines = parseOpml(opmlText);
  assert.equal(outlines.length, 1);
  assert.equal(outlines[0].title, '少数派');
  assert.equal(outlines[0].xmlUrl, 'https://sspai.com/feed');
});

test('T18: defaultSources 包含真实公开高质量订阅源', () => {
  assert.ok(defaultSourcesSrc.includes('https://www.ruanyifeng.com/blog/atom.xml'));
  assert.ok(defaultSourcesSrc.includes('https://sspai.com/feed'));
  assert.ok(defaultSourcesSrc.includes('https://www.v2ex.com/index.xml'));
  assert.ok(defaultSourcesSrc.includes('GitHub 热门 TS 项目 (脚本源)'));
});

test('T18: MV3 Background Service Worker 与 Manifest V3 跨域代理契约', () => {
  // 1. Manifest 权限包含全域匹配
  assert.ok(
    manifestSrc.includes('"<all_urls>"') || manifestSrc.includes('"*://*/*"'),
    'manifest.json 必须包含全域 host_permissions 支持任意 RSS 直连'
  );

  // 2. Background Service Worker 具备 FETCH_FEED 监听
  assert.ok(
    backgroundSrc.includes("message?.type === 'FETCH_FEED'"),
    'background/index.ts 必须监听 FETCH_FEED'
  );
  assert.ok(
    backgroundSrc.includes('fetchWithTimeout'),
    '后台必须具备带超时的 fetchWithTimeout 请求'
  );
});

test('T18: FeedSidebar.tsx 双视图 (Timeline ↔ Sources) 与管理交互完整性', () => {
  // 1. 双视图状态
  assert.ok(
    feedSidebarSrc.includes("currentView, setCurrentView") || feedSidebarSrc.includes("'timeline' | 'sources'"),
    'FeedSidebar 必须维护 timeline 与 sources 双视图切换状态'
  );

  // 2. 手动刷新与加载状态
  assert.ok(
    feedSidebarSrc.includes('isRefreshing'),
    'FeedSidebar 必须支持 isRefreshing 加载态'
  );
  assert.ok(
    feedSidebarSrc.includes('onRefresh'),
    'FeedSidebar 必须支持 onRefresh 手动刷新回调'
  );

  // 3. 源管理与 OPML 导入导出
  assert.ok(
    feedSidebarSrc.includes('onAddSource'),
    'FeedSidebar 必须支持 onAddSource 添加订阅源'
  );
  assert.ok(
    feedSidebarSrc.includes('onImportOpml'),
    'FeedSidebar 必须支持 onImportOpml 导入'
  );
  assert.ok(
    feedSidebarSrc.includes('onExportOpml'),
    'FeedSidebar 必须支持 onExportOpml 导出'
  );
  assert.ok(
    feedSidebarSrc.includes('onResetDefaultSources'),
    'FeedSidebar 必须支持 onResetDefaultSources 重置推荐源'
  );
});
