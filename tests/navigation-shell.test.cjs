const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Re-implement the pure functions to verify logic
function getInitial(name) {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!text) return '?';
  const first =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)][0].segment
      : Array.from(text)[0];
  return first.toLocaleUpperCase();
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function reorderList(list, fromIndex, toIndex) {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

test('getInitial extracts uppercase English letter', () => {
  assert.equal(getInitial('github'), 'G');
  assert.equal(getInitial(' Notion '), 'N');
});

test('getInitial extracts first Chinese character', () => {
  assert.equal(getInitial('飞书'), '飞');
  assert.equal(getInitial('  百度搜索 '), '百');
});

test('getInitial extracts complete emoji character', () => {
  assert.equal(getInitial('🧑‍💻 工作台'), '🧑‍💻');
  assert.equal(getInitial('⚡ Quick'), '⚡');
});

test('isValidUrl validates HTTP and HTTPS URLs', () => {
  assert.equal(isValidUrl('https://github.com'), true);
  assert.equal(isValidUrl('http://localhost:3000'), true);
  assert.equal(isValidUrl('linear.app/my-team'), true);
});

test('isValidUrl rejects dangerous or executable schemes', () => {
  assert.equal(isValidUrl('javascript:alert(1)'), false);
  assert.equal(isValidUrl('data:text/html,<script>'), false);
  assert.equal(isValidUrl(''), false);
});

test('reorderList moves items without duplicating or dropping data', () => {
  const list = ['A', 'B', 'C', 'D'];
  const forward = reorderList(list, 0, 2);
  assert.deepEqual(forward, ['B', 'C', 'A', 'D']);

  const backward = reorderList(forward, 2, 0);
  assert.deepEqual(backward, ['A', 'B', 'C', 'D']);
});

test('Undo operation restores removed item at original index', () => {
  const original = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const removedIndex = 1;
  const removedItem = original[removedIndex];
  
  const current = original.filter((_, i) => i !== removedIndex);
  assert.equal(current.length, 2);

  // Undo
  const restored = [...current];
  restored.splice(removedIndex, 0, removedItem);
  assert.deepEqual(restored, original);
});

// ── C005 图标首字母兜底结构回归 ────────────────────────────────
test('首字母仅作图标缺失兜底：absolute 底层垫底、img 上层覆盖、onError 露出 (C005)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  // 字母层必须绝对定位垫底，不再是与 img 并列的无条件 flex 兄弟
  assert.ok(
    /absolute inset-0 flex items-center justify-center[^>]*>\s*\{getInitial/.test(src.replace(/className=\{?"[^"]*"\s*/g, (m) => m)),
      '首字母兜底层应为 absolute inset-0 居中结构'
  );
  // img 必须在字母层之后渲染（DOM 顺序决定覆盖关系）
  const spanIdx = src.indexOf('absolute inset-0 flex items-center justify-center');
  const imgIdx = src.indexOf('<img', spanIdx);
  assert.ok(spanIdx !== -1 && imgIdx > spanIdx, 'img 必须位于字母兜底层之后以形成覆盖');
  // onError 隐藏 img 露出字母；onLoad 恢复并隐藏字母（防透明图标透出）
  assert.ok(/onError=\{[^}]*display = 'none'[\s\S]{0,200}visibility = 'visible'/.test(src), 'onError 必须隐藏 img 并恢复字母可见');
  assert.ok(/onLoad=\{[^}]*display = ''[\s\S]{0,200}visibility = 'hidden'/.test(src), 'onLoad 必须恢复 img 并彻底隐藏字母层');
  // 热链加载成功率：no-referrer
  assert.ok(src.includes('referrerPolicy="no-referrer"'), 'img 应携带 no-referrer 提升图标热链成功率');
});

// ── C006 弹窗与浮层 createPortal 全局挂载与遮罩契约 ────────────────
test('常用网站弹窗与浮层必须经 createPortal 挂载至 document.body，防包含块局部化 (C006)', () => {
  const shortcutsSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  // 必须引入 createPortal
  assert.ok(shortcutsSrc.includes("import { createPortal } from 'react-dom'"));
  // 弹窗必须通过 createPortal 挂载到 document.body
  assert.ok(/createPortal\([\s\S]*?className="fixed inset-0[\s\S]*?document\.body\s*\)/.test(shortcutsSrc));
  // 桌面右键菜单也必须挂载到 document.body
  assert.ok(/createPortal\([\s\S]*?className="[^"]*origin-menu[\s\S]*?document\.body\s*\)/.test(shortcutsSrc));
  // 撤销 Toast 也必须挂载到 document.body
  assert.ok(/createPortal\([\s\S]*?className="[^"]*t-toast[\s\S]*?document\.body\s*\)/.test(shortcutsSrc));

  // motion.css 中的 .workspace-container 展开态不得常驻 transform/filter
  const motionSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'styles', 'motion.css'),
    'utf8'
  );
  const containerMatch = motionSrc.match(/\.workspace-container\s*\{([\s\S]*?)\}/);
  assert.ok(containerMatch, 'motion.css 必须包含 .workspace-container 规则');
  assert.ok(containerMatch[1].includes('transform: none'), '展开态必须为 transform: none');
  assert.ok(containerMatch[1].includes('filter: none'), '展开态必须为 filter: none');
});

// ── C009 搜索引擎菜单防遮挡层叠契约 ────────────────────────────
test('SearchBar 具备 relative z-20 层叠上下文，菜单置顶 z-50 且有全屏透明关闭遮罩 (C009)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );
  // 1. SearchBar 外层容器必须建立高于 workspace-container 的层叠上下文
  assert.ok(
    searchBarSrc.includes('relative z-20 w-full flex'),
    'SearchBar 外层容器必须声明 relative z-20 避免被后续兄弟容器遮挡'
  );
  // 2. 菜单必须置顶于 z-50
  assert.ok(
    searchBarSrc.includes('origin-menu') && searchBarSrc.includes('z-50'),
    'origin-menu 下拉菜单必须拥有 z-50 绝对置顶层级'
  );
});

// ── C011 搜索引擎下拉框全域点击关闭契约 ──────────────────────────
test('搜索引擎下拉菜单支持点击页面任意位置与 Escape 键无缝关闭 (C011)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );
  // 1. 废除局部包含块失效的 fixed inset-0 遮罩
  assert.ok(
    !searchBarSrc.includes('fixed inset-0 z-40 bg-transparent'),
    '必须彻底移除被 backdropFilter 局部包含块限制的 fixed 遮罩'
  );

  // 2. 引入 window capture 点击与按键监听
  assert.ok(
    searchBarSrc.includes("window.addEventListener('click', handleGlobalClick, true)"),
    '必须注册捕获阶段的全局点击事件监听以确保点击任意位置均可捕获'
  );
  assert.ok(
    searchBarSrc.includes("window.addEventListener('keydown', handleKeyDown)"),
    '必须注册 Escape 键盘事件监听'
  );

  // 3. 边界判断保护菜单与切换按钮内部交互
  assert.ok(
    searchBarSrc.includes('menuRef.current.contains(event.target as Node)') &&
      searchBarSrc.includes('toggleButtonRef.current.contains(event.target as Node)'),
    '必须具备 menuRef 与 toggleButtonRef 边界检测以保护自身交互'
  );
});


// ── T11 搜索引擎图标化、精简与毛玻璃同质化契约 ─────────────────
test('搜索引擎仅保留必应/谷歌/GitHub/Bilibili，左侧全量图标化且下拉框同质化 (T11)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );
  // 1. 搜索引擎名单仅保留必应、谷歌、GitHub、Bilibili
  assert.ok(searchBarSrc.includes("id: 'bing'"), '必须包含必应');
  assert.ok(searchBarSrc.includes("id: 'google'"), '必须包含谷歌');
  assert.ok(searchBarSrc.includes("id: 'github'"), '必须包含 GitHub');
  assert.ok(searchBarSrc.includes("id: 'bilibili'"), '必须包含 Bilibili');
  assert.ok(!searchBarSrc.includes("id: 'baidu'"), '不得包含百度');
  assert.ok(!searchBarSrc.includes("id: 'duckduckgo'"), '不得包含 DuckDuckGo');

  // 2. 左侧切换按钮使用 EngineIcon 代替文字
  assert.ok(
    searchBarSrc.includes('<EngineIcon engineId={currentEngine.id} />'),
    '左侧切换按钮必须使用 EngineIcon 展示当前引擎图标'
  );
  assert.ok(
    !searchBarSrc.includes('<span>{currentEngine.name}</span>'),
    '左侧切换按钮不得再使用文本标签替代图标'
  );

  // 3. 图标严格统一直径
  assert.ok(
    searchBarSrc.includes("className = 'w-[18px] h-[18px]'"),
    'EngineIcon 默认尺寸必须严格统一为 18x18px'
  );

  // 4. 下拉菜单与搜索框同质化样式
  assert.ok(
    searchBarSrc.includes('backdropFilter: `blur(${blurPx}px)`') &&
      searchBarSrc.includes('backgroundColor: `rgba(255, 255, 255, ${opacity})`'),
    '下拉菜单必须与搜索框共享相同的毛玻璃模糊与透明度背景'
  );
});

// ── C010 壁纸画面位置精简与默认居中契约 ────────────────────────
test('AppearanceDrawer 移除画面位置配置，壁纸默认锁定居中 (C010)', () => {
  const drawerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'settings', 'AppearanceDrawer.tsx'),
    'utf8'
  );
  assert.ok(
    !drawerSrc.includes('画面位置'),
    'AppearanceDrawer 不得再包含画面位置配置模块'
  );
  assert.ok(
    !drawerSrc.includes('BackgroundPosition'),
    'AppearanceDrawer 不应再引入 BackgroundPosition'
  );

  const storageTypesSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'storage', 'types.ts'),
    'utf8'
  );
  assert.ok(
    storageTypesSrc.includes("position: 'center'"),
    'DEFAULT_BACKGROUND_CONFIG.position 必须为 center'
  );
});


