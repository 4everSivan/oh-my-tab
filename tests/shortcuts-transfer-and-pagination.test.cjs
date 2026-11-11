const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 导入转译后的核心纯函数
const { isValidUrl } = require('../docs/assets/homepage-study/homepage-model.js');

function parseShortcutsFromJSON(jsonText) {
  if (!jsonText || typeof jsonText !== 'string') {
    return { valid: [], error: '导入的文件内容为空' };
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { valid: [], error: 'JSON 文件格式不合规，无法解析' };
  }

  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.shortcuts)) {
    rawList = parsed.shortcuts;
  } else {
    return { valid: [], error: '未识别到合法的常用网站数据列表' };
  }

  const validShortcuts = [];
  let index = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const rawName = typeof item.name === 'string' ? item.name.trim() : '';
    const rawUrl = typeof item.url === 'string' ? item.url.trim() : '';
    if (!rawName || !rawUrl) continue;

    // 协议校验
    try {
      const parsedUrl = new URL(rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') continue;
    } catch {
      continue;
    }

    const fullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
    const cleanName = rawName.slice(0, 30);
    const id = typeof item.id === 'string' && item.id ? item.id : `imported-${Date.now()}-${index++}`;

    validShortcuts.push({ id, name: cleanName, url: fullUrl });
  }

  if (validShortcuts.length === 0) {
    return { valid: [], error: '文件中未找到有效的网站条目' };
  }
  return { valid: validShortcuts };
}

function mergeShortcuts(imported, current, mode = 'merge') {
  if (mode === 'replace') return imported;
  const existingUrls = new Set(
    current.map((s) => s.url.replace(/\/+$/, '').toLowerCase())
  );
  const toAdd = [];
  for (const item of imported) {
    const norm = item.url.replace(/\/+$/, '').toLowerCase();
    if (!existingUrls.has(norm)) {
      existingUrls.add(norm);
      toAdd.push(item);
    }
  }
  return [...current, ...toAdd];
}

test('T14: parseShortcutsFromJSON 正确解析标准 JSON 并执行安全防御', () => {
  // 1. 标准结构解析
  const validData = JSON.stringify({
    version: '1.0',
    shortcuts: [
      { id: 'site-1', name: 'GitHub', url: 'https://github.com' },
      { name: '  Bilibili 视频  ', url: 'bilibili.com' },
    ],
  });
  const res1 = parseShortcutsFromJSON(validData);
  assert.equal(res1.valid.length, 2);
  assert.equal(res1.valid[0].name, 'GitHub');
  assert.equal(res1.valid[1].name, 'Bilibili 视频');
  assert.equal(res1.valid[1].url, 'https://bilibili.com');

  // 2. 拦截危险协议注入 (javascript:, data:)
  const maliciousData = JSON.stringify({
    shortcuts: [
      { name: 'XSS Attack', url: 'javascript:alert(document.cookie)' },
      { name: 'Data Protocol', url: 'data:text/html,<script>alert(1)</script>' },
      { name: 'Legit', url: 'https://developer.mozilla.org' },
    ],
  });
  const res2 = parseShortcutsFromJSON(maliciousData);
  assert.equal(res2.valid.length, 1);
  assert.equal(res2.valid[0].name, 'Legit');

  // 3. 错误处理与截断防御
  assert.ok(parseShortcutsFromJSON('invalid json content').error);
  assert.ok(parseShortcutsFromJSON('').error);
  assert.ok(parseShortcutsFromJSON('{}').error);

  const longNameData = JSON.stringify([
    { name: 'A'.repeat(50), url: 'https://example.com' },
  ]);
  const res3 = parseShortcutsFromJSON(longNameData);
  assert.equal(res3.valid[0].name.length, 30);
});

test('T14: mergeShortcuts 支持合并去重与覆盖模式', () => {
  const current = [
    { id: '1', name: 'Google', url: 'https://www.google.com' },
    { id: '2', name: 'GitHub', url: 'https://github.com' },
  ];
  const imported = [
    { id: '3', name: 'GitHub Duplicate', url: 'https://github.com/' }, // 结尾斜杠容错去重
    { id: '4', name: 'V2EX', url: 'https://v2ex.com' },
  ];

  // 合并模式：仅追加未存在的 V2EX
  const merged = mergeShortcuts(imported, current, 'merge');
  assert.equal(merged.length, 3);
  assert.equal(merged[2].name, 'V2EX');

  // 覆盖模式：完全替换
  const replaced = mergeShortcuts(imported, current, 'replace');
  assert.equal(replaced.length, 2);
  assert.equal(replaced[0].name, 'GitHub Duplicate');
});

test('T20: 启动台以响应式网格替代单排分页与滚动翻页', () => {
  const shortcutsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  const transferSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'shortcuts', 'transfer.ts'),
    'utf8'
  );

  // 导出契约保持不变
  assert.ok(shortcutsSrc.includes('export { exportShortcutsToJSON as exportShortcuts }'), '启动台必须导出 exportShortcuts');
  assert.ok(transferSrc.includes('export function exportShortcutsToJSON'), 'transfer 必须导出 exportShortcutsToJSON');
  assert.ok(transferSrc.includes('export function parseShortcutsFromJSON'), 'transfer 必须导出 parseShortcutsFromJSON');
  assert.ok(transferSrc.includes('export function mergeShortcuts'), 'transfer 必须导出 mergeShortcuts');

  // 启动台网格与过滤
  assert.ok(shortcutsSrc.includes('lg:grid-cols-8'), '桌面须使用 8 列启动台网格');
  assert.ok(shortcutsSrc.includes('filteredShortcuts'), '须按名称过滤网站');
  assert.ok(shortcutsSrc.includes('搜索网站'), '须提供启动台搜索框');
  assert.ok(shortcutsSrc.includes('没有找到匹配的网站'), '无匹配时须展示空状态');

  // 旧分页与翻页彻底移除
  assert.ok(!shortcutsSrc.includes('PAGE_SIZE'), '不得再限制单页 6 图标');
  assert.ok(!shortcutsSrc.includes('flex flex-nowrap'), '不得再使用单排 flex-nowrap');
  assert.ok(!shortcutsSrc.includes('totalPages > 1'), '不得再渲染分页指示器');
  assert.ok(!shortcutsSrc.includes('onWheel={handleWheel}'), '不得再支持滚轮翻页');
  assert.ok(!shortcutsSrc.includes("e.key === 'ArrowRight'"), '不得再支持方向键翻页');
  assert.ok(!shortcutsSrc.includes("e.key === 'ArrowLeft'"), '不得再支持方向键翻页');
});
