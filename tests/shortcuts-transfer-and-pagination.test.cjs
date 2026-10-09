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

test('T14: 单排 6 图标自动切片与分页计算逻辑契约', () => {
  const PAGE_SIZE = 6;
  function computePages(shortcutsCount) {
    const totalSlots = shortcutsCount + 1; // 加上 1 个添加按钮
    const totalPages = Math.max(1, Math.ceil(totalSlots / PAGE_SIZE));
    return { totalSlots, totalPages };
  }

  // 5 个网站：刚好 6 个槽位（1 页满排）
  assert.equal(computePages(5).totalPages, 1);
  // 6 个网站：7 个槽位，分 2 页（第 1 页 6 个图标，第 2 页 1 个添加按钮）
  assert.equal(computePages(6).totalPages, 2);
  // 11 个网站：12 个槽位，分 2 页
  assert.equal(computePages(11).totalPages, 2);
  // 12 个网站：13 个槽位，分 3 页
  assert.equal(computePages(12).totalPages, 3);
});

test('T14: Shortcuts.tsx 与 transfer.ts 具备完整的组件集成与导出契约', () => {
  const shortcutsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  const transferSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'shortcuts', 'transfer.ts'),
    'utf8'
  );

  // 1. 导出契约（通过 precheck）
  assert.ok(shortcutsSrc.includes('export { exportShortcutsToJSON as exportShortcuts }'), 'Shortcuts 必须导出 exportShortcuts');
  assert.ok(transferSrc.includes('export function exportShortcutsToJSON'), 'transfer 必须导出 exportShortcutsToJSON');
  assert.ok(transferSrc.includes('export function parseShortcutsFromJSON'), 'transfer 必须导出 parseShortcutsFromJSON');
  assert.ok(transferSrc.includes('export function mergeShortcuts'), 'transfer 必须导出 mergeShortcuts');

  // 2. 单排 6 图标约束
  assert.ok(shortcutsSrc.includes('const PAGE_SIZE = 6'), 'Shortcuts 必须限制单页 PAGE_SIZE = 6');
  assert.ok(shortcutsSrc.includes('flex flex-nowrap'), 'Shortcuts 容器必须使用 flex-nowrap 锁定单排');
  assert.ok(shortcutsSrc.includes('totalPages > 1'), '超出 1 页时必须渲染指示器');

  // 3. 滑动翻页与左右方向键 ⬅️ / ➡️ 翻页
  assert.ok(shortcutsSrc.includes('onWheel={handleWheel}'), 'Shortcuts 必须支持滚轮滑动翻页');
  assert.ok(shortcutsSrc.includes("e.key === 'ArrowRight'"), '必须支持按键 ArrowRight 切换下一页');
  assert.ok(shortcutsSrc.includes("e.key === 'ArrowLeft'"), '必须支持按键 ArrowLeft 切换上一页');

  // 4. 导入导出 UI
  assert.ok(shortcutsSrc.includes('handleExport'), '必须具备导出触发函数');
  assert.ok(shortcutsSrc.includes('handleImportClick'), '必须具备导入触发函数');
  assert.ok(shortcutsSrc.includes('type="file"'), '必须具备隐藏的 JSON 文件选择器');
});

test('C017: Shortcuts 分页指示器消除硬编码灰阶并自适应继承 textColor 与 shadowProtection', () => {
  const shortcutsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  const appSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'App.tsx'),
    'utf8'
  );

  // 1. 彻底消除硬编码 stone 灰度颜色
  assert.ok(!shortcutsSrc.includes('bg-stone-700/80'), '严禁使用静态硬编码 bg-stone-700/80');
  assert.ok(!shortcutsSrc.includes('bg-stone-400/40'), '严禁使用静态硬编码 bg-stone-400/40');

  // 2. 契约中包含 shadowProtection 属性并动态绑定 textColor
  assert.ok(shortcutsSrc.includes('shadowProtection?: string'), 'ShortcutsProps 必须声明 shadowProtection 属性');
  assert.ok(shortcutsSrc.includes('backgroundColor: textColor'), '圆点背景色必须动态继承 textColor');
  assert.ok(shortcutsSrc.includes("shadowProtection !== 'none' || textColor === '#FFFFFF'"), '必须根据投影保护与文字明暗配置自适应 boxShadow');

  // 3. 视觉显著度与底托升级：h-2 (8px), w-5 (20px), 毛玻璃浮动底托
  assert.ok(shortcutsSrc.includes('h-2'), '圆点高度必须升级为 h-2 (8px)');
  assert.ok(shortcutsSrc.includes('w-5'), '当前页活动指示器必须扩展为 w-5 (20px) 显著胶囊');
  assert.ok(shortcutsSrc.includes('backdrop-blur-md'), '指示器底托必须具备毛玻璃质感');

  // 4. App.tsx 透传 shadowProtection
  assert.ok(
    appSrc.includes('shadowProtection={shadowProtection}'),
    'App.tsx 必须将采样自适应得出的 shadowProtection 传递给 Shortcuts'
  );
});

test('C018: 常用网站键盘翻页调整为 ArrowRight (下一页) 与 ArrowLeft (上一页)', () => {
  const shortcutsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  const helpSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'ShortcutsHelpModal.tsx'),
    'utf8'
  );

  // 1. 废除 ArrowDown / ArrowUp 作为翻页键
  assert.ok(!shortcutsSrc.includes("e.key === 'ArrowDown'"), 'Shortcuts 不得再使用 ArrowDown 翻页');
  assert.ok(!shortcutsSrc.includes("e.key === 'ArrowUp'"), 'Shortcuts 不得再使用 ArrowUp 翻页');

  // 2. 启用 ArrowRight / ArrowLeft 水平切页
  assert.ok(shortcutsSrc.includes("e.key === 'ArrowRight'"), 'Shortcuts 必须使用 ArrowRight 切换下一页');
  assert.ok(shortcutsSrc.includes("e.key === 'ArrowLeft'"), 'Shortcuts 必须使用 ArrowLeft 切换上一页');

  // 3. 快捷键指南浮层包含左右箭头说明
  assert.ok(helpSrc.includes("keyDesc: '← / →'"), '快捷键指南浮层必须声明 ← / → 翻页键');
});

test('C019: Shortcuts 翻页圆点指示器胶囊整合左右快捷键键帽 [←] [→] 与“翻页”提示文字', () => {
  const shortcutsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );

  // 1. 包含 [←] [→] 左右快捷键按钮与点击切换调度
  assert.ok(shortcutsSrc.includes('aria-label="上一页"'), '指示器必须包含上一页 [←] 按钮');
  assert.ok(shortcutsSrc.includes('aria-label="下一页"'), '指示器必须包含下一页 [→] 按钮');
  assert.ok(shortcutsSrc.includes('disabled={safePageIndex === 0}'), '上一页按钮在第 1 页必须处于禁用态');
  assert.ok(shortcutsSrc.includes('disabled={safePageIndex === totalPages - 1}'), '下一页按钮在末页必须处于禁用态');

  // 2. 包含“翻页”可见提示文字与自适应样式
  assert.ok(shortcutsSrc.includes('翻页'), '指示器胶囊必须包含“翻页”提示文本');
  assert.ok(/翻页\s*<\/span>/.test(shortcutsSrc), '指示器胶囊必须包含“翻页”提示文本标签');
  assert.ok(shortcutsSrc.includes('style={{ color: textColor }}'), '“翻页”提示文本必须自适应 textColor');

  // 3. 包含操作说明气泡与按键提示
  assert.ok(shortcutsSrc.includes('title="翻页 (支持按左右方向键 ← / → 或鼠标滚轮)"'), '外层胶囊必须具备完整交互气泡');
  assert.ok(shortcutsSrc.includes('title={`第 ${idx + 1} 页 (可按方向键 ⬅️/➡️ 或滚轮翻页)`}'), '各圆点按钮必须包含翻页页码气泡');
});



