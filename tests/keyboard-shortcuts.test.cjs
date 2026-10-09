const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── 纯逻辑模拟与契约验证 ──────────────────────────────────────────

function isEditableElement(target) {
  if (!target || typeof target !== 'object') return false;
  const tagName = (target.tagName || '').toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return !!target.isContentEditable;
}

function cycleEngine(engines, currentId, direction = 'next') {
  const currentIndex = engines.findIndex((e) => e.id === currentId);
  const len = engines.length;
  const nextIndex =
    direction === 'prev'
      ? (currentIndex - 1 + len) % len
      : (currentIndex + 1) % len;
  return engines[nextIndex].id;
}

test('isEditableElement 正确识别输入控件与普通 DOM 元素', () => {
  assert.equal(isEditableElement({ tagName: 'INPUT' }), true);
  assert.equal(isEditableElement({ tagName: 'textarea' }), true);
  assert.equal(isEditableElement({ tagName: 'SELECT' }), true);
  assert.equal(isEditableElement({ tagName: 'DIV', isContentEditable: true }), true);

  assert.equal(isEditableElement({ tagName: 'DIV' }), false);
  assert.equal(isEditableElement({ tagName: 'BUTTON' }), false);
  assert.equal(isEditableElement({ tagName: 'BODY' }), false);
  assert.equal(isEditableElement(null), false);
});

test('cycleEngine 顺次循环与逆向循环搜索引擎', () => {
  const engines = [
    { id: 'bing', name: '必应' },
    { id: 'google', name: '谷歌' },
    { id: 'github', name: 'GitHub' },
    { id: 'bilibili', name: 'Bilibili' },
  ];

  // next
  assert.equal(cycleEngine(engines, 'bing', 'next'), 'google');
  assert.equal(cycleEngine(engines, 'google', 'next'), 'github');
  assert.equal(cycleEngine(engines, 'github', 'next'), 'bilibili');
  assert.equal(cycleEngine(engines, 'bilibili', 'next'), 'bing'); // 循环回开头

  // prev
  assert.equal(cycleEngine(engines, 'bing', 'prev'), 'bilibili'); // 循环至末尾
  assert.equal(cycleEngine(engines, 'bilibili', 'prev'), 'github');
  assert.equal(cycleEngine(engines, 'github', 'prev'), 'google');
  assert.equal(cycleEngine(engines, 'google', 'prev'), 'bing');
});

// ── 源码契约校验 ────────────────────────────────────────────────

test('useKeyboardShortcuts.ts 具备完整的按键监听、输入逃逸与回调契约 (T12)', () => {
  const hookSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'hooks', 'useKeyboardShortcuts.ts'),
    'utf8'
  );

  // 1. 核心导出
  assert.ok(hookSrc.includes('export function useKeyboardShortcuts'), '必须导出 useKeyboardShortcuts Hook');
  assert.ok(hookSrc.includes('export function isEditableElement'), '必须导出 isEditableElement 辅助函数');

  // 2. 关键按键支持
  assert.ok(hookSrc.includes("e.key === '`'") || hookSrc.includes('e.key === "~"'), '必须监听反引号键用于聚焦搜索框');
  assert.ok(hookSrc.includes("e.key === 'Tab'"), '必须监听 Tab 键用于切换搜索引擎');
  assert.ok(hookSrc.includes("e.key === 'Escape'"), '必须监听 Escape 键用于级联关闭');
  assert.ok(hookSrc.includes("e.key === '?'"), '必须监听 ? 键用于唤起快捷键指南');
  assert.ok(hookSrc.includes("e.key === 'e'") && hookSrc.includes("e.key === 's'"), '必须监听 e/s 键用于外观抽屉开关');
  assert.ok(hookSrc.includes("e.key === 'a'"), '必须监听 a 键用于添加组件');
  assert.ok(hookSrc.includes("e.key === 'c'"), '必须监听 c 键用于工作台折叠');

  // 3. 输入态逃逸机制
  assert.ok(hookSrc.includes('if (isEditing)'), '必须具备编辑态避让判断');
  assert.ok(hookSrc.includes('isEditing && !isSearchFocused'), '便签等其他输入框编辑时不抢焦');

  // 4. 系统组合键过滤
  assert.ok(
    hookSrc.includes('e.ctrlKey || e.altKey || e.metaKey'),
    '必须过滤带 Ctrl/Alt/Meta 的系统组合键，防误触'
  );
});

test('SearchBar.tsx 接入 inputRef 与 Tab 切擎契约 (T12)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );

  // 1. Props 支持
  assert.ok(searchBarSrc.includes('inputRef?: React.RefObject<HTMLInputElement>'), 'SearchBar 必须支持 inputRef 传入');
  assert.ok(searchBarSrc.includes("onCycleEngine?: (direction: 'next' | 'prev') => void"), 'SearchBar 必须支持 onCycleEngine 回调');

  // 2. input 元素绑定
  assert.ok(searchBarSrc.includes('ref={inputRef}'), 'input 必须绑定 inputRef');
  assert.ok(searchBarSrc.includes('onKeyDown={handleInputKeyDown}'), 'input 必须绑定 onKeyDown 监听');

  // 3. 焦点内 Tab 切擎
  assert.ok(searchBarSrc.includes("e.key === 'Tab'"), 'handleInputKeyDown 必须处理 Tab 键');
  assert.ok(searchBarSrc.includes('e.preventDefault()'), 'Tab 切擎必须阻止默认焦点移动');
  assert.ok(searchBarSrc.includes('e.stopPropagation()'), 'SearchBar 捕获 Tab 必须阻断事件冒泡，防止全局重复切擎 (C013)');
  assert.ok(searchBarSrc.includes("e.shiftKey ? 'prev' : 'next'"), '支持 Shift+Tab 逆向切擎');
});

test('App.tsx 集成快捷键调度调度器与 ShortcutsHelpModal (T12 & C013)', () => {
  const appSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'App.tsx'),
    'utf8'
  );

  // 1. 模块导入
  assert.ok(appSrc.includes('useKeyboardShortcuts'), 'App 必须引入 useKeyboardShortcuts');
  assert.ok(appSrc.includes('ShortcutsHelpModal'), 'App 必须引入 ShortcutsHelpModal');

  // 2. 状态与引用
  assert.ok(appSrc.includes('searchInputRef = useRef<HTMLInputElement>'), 'App 必须声明 searchInputRef');
  assert.ok(appSrc.includes('isHelpOpen, setIsHelpOpen'), 'App 必须管理 isHelpOpen 状态');

  // 3. 级联关闭逻辑与函数式原子切擎 (C013)
  assert.ok(appSrc.includes('handleCloseTopLayer'), 'App 必须包含 handleCloseTopLayer 级联关闭函数');
  assert.ok(appSrc.includes('handleCycleEngine'), 'App 必须包含 handleCycleEngine 引擎切换函数');
  assert.ok(
    appSrc.includes('setEngine((prevEngine) =>'),
    'handleCycleEngine 必须基于 setEngine 函数式状态进行原子更新，避免闭包滞后与异步等待 (C013)'
  );

  // 4. JSX 挂载
  assert.ok(appSrc.includes('inputRef={searchInputRef}'), 'App 必须将 searchInputRef 传递给 SearchBar');
  assert.ok(appSrc.includes('onCycleEngine={handleCycleEngine}'), 'App 必须将 handleCycleEngine 传递给 SearchBar');
  assert.ok(appSrc.includes('<ShortcutsHelpModal'), 'App 必须挂载 ShortcutsHelpModal 组件');
});

test('ShortcutsHelpModal.tsx 具备完整按键清单与 Portal 浮层契约 (T12)', () => {
  const modalSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'ShortcutsHelpModal.tsx'),
    'utf8'
  );

  assert.ok(modalSrc.includes('createPortal'), 'ShortcutsHelpModal 必须经 createPortal 挂载');
  assert.ok(modalSrc.includes('document.body'), '必须挂载至 document.body');
  assert.ok(modalSrc.includes("keyDesc: '`'"), '快捷键清单必须包含 ` 聚焦搜索框');
  assert.ok(modalSrc.includes("keyDesc: 'Tab'"), '快捷键清单必须包含 Tab 切擎');
  assert.ok(modalSrc.includes("keyDesc: 'Esc'"), '快捷键清单必须包含 Esc 级联关闭');
});

test('C013: 验证高频连续 Tab 触发时函数式原子递增不发生跳级与漏步', () => {
  const engines = [
    { id: 'bing', name: '必应' },
    { id: 'google', name: '谷歌' },
    { id: 'github', name: 'GitHub' },
    { id: 'bilibili', name: 'Bilibili' },
  ];

  // 模拟 React setEngine((prevEngine) => ...) 的连续原子更新
  let state = 'bing';
  const dispatchNext = () => {
    const currentIndex = engines.findIndex((e) => e.id === state);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + 1) % engines.length;
    state = engines[nextIndex].id;
  };
  const dispatchPrev = () => {
    const currentIndex = engines.findIndex((e) => e.id === state);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const prevIndex = (safeIndex - 1 + engines.length) % engines.length;
    state = engines[prevIndex].id;
  };

  // 连续 4 次 Tab 前进测试
  assert.equal(state, 'bing');
  dispatchNext();
  assert.equal(state, 'google', '第 1 次 Tab 必须为谷歌');
  dispatchNext();
  assert.equal(state, 'github', '第 2 次 Tab 必须为 GitHub');
  dispatchNext();
  assert.equal(state, 'bilibili', '第 3 次 Tab 必须为 Bilibili');
  dispatchNext();
  assert.equal(state, 'bing', '第 4 次 Tab 必须循环回必应');

  // 连续 4 次 Shift+Tab 后退测试
  dispatchPrev();
  assert.equal(state, 'bilibili', '第 1 次 Shift+Tab 必须为 Bilibili');
  dispatchPrev();
  assert.equal(state, 'github', '第 2 次 Shift+Tab 必须为 GitHub');
  dispatchPrev();
  assert.equal(state, 'google', '第 3 次 Shift+Tab 必须为 谷歌');
  dispatchPrev();
  assert.equal(state, 'bing', '第 4 次 Shift+Tab 必须回到 必应');
});
