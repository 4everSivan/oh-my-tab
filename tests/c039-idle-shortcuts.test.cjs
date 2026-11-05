const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const shortcutsPath = path.join(ROOT, 'src/components/shortcuts/Shortcuts.tsx');
const source = ts.createSourceFile(
  shortcutsPath, fs.readFileSync(shortcutsPath, 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
);

// 执行真实组件的完整键盘 effect，覆盖监听注册、依赖变化与清理，避免复制处理逻辑。
const keyboardEffects = [];
function collectEffects(node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') {
    const text = node.getText(source);
    if (text.includes("window.addEventListener('keydown', handleKeyDown)")) {
      keyboardEffects.push(text);
    }
  }
  ts.forEachChild(node, collectEffects);
}
collectEffects(source);
assert.equal(keyboardEffects.length, 2, '应覆盖翻页和数字快捷键两个独立监听');
const effectScript = new vm.Script(ts.transpileModule(keyboardEffects.join(';\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText);

function createKeyboardHarness(initial = {}) {
  const pageShortcuts = Array.from({ length: 6 }, (_, index) => ({
    id: `site-${index + 7}`, name: `Site ${index + 7}`,
    url: `https://site${index + 7}.example`,
  }));
  let props = {
    suspended: false, shortcutKeysEnabled: true, pageShortcuts,
    totalPages: 3, expandedFolderId: null, editingShortcut: null,
    isAdding: false, renameFolder: null, ...initial,
  };
  const state = {
    isCmdPressed: false, activeKeySiteId: null, expandedFolderId: null,
    pageIndex: 1, toastMessage: null,
  };
  const listeners = new Map();
  const effects = [];
  const location = { href: 'about:blank' };
  let effectIndex = 0;
  const sandbox = {
    document: { activeElement: null },
    isEditableElement: () => false,
    setIsCmdPressed: (value) => { state.isCmdPressed = value; },
    setActiveKeySiteId: (value) => { state.activeKeySiteId = value; },
    setExpandedFolderId: (value) => { state.expandedFolderId = value; },
    setToastMessage: (value) => { state.toastMessage = value; },
    setPageIndex: (updater) => { state.pageIndex = updater(state.pageIndex); },
    // 只记录同步键盘行为，不启动反馈动效的真实计时器。
    setTimeout: () => 1,
    window: {
      location,
      addEventListener(type, handler) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(handler);
      },
      removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    },
    useEffect(callback, dependencies) {
      const index = effectIndex++;
      const previous = effects[index];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) {
        return;
      }
      previous?.cleanup?.();
      effects[index] = { dependencies, cleanup: callback() };
    },
  };
  function render(next = {}) {
    props = { ...props, ...next };
    effectIndex = 0;
    effectScript.runInNewContext({ ...sandbox, ...props });
  }
  function keydown(key, modifiers = {}) {
    let prevented = false;
    const event = {
      key, target: null, metaKey: false, ctrlKey: false,
      altKey: false, shiftKey: false, ...modifiers,
      preventDefault: () => { prevented = true; },
    };
    for (const handler of listeners.get('keydown') || []) handler(event);
    return prevented;
  }
  render();
  return { render, keydown, state, location, listeners };
}

test('C039: App 将真实闲置状态传给网站组件，并保留持久化快捷键开关', () => {
  const appPath = path.join(ROOT, 'src/App.tsx');
  const app = ts.createSourceFile(
    appPath, fs.readFileSync(appPath, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
  );
  let attributes;
  function findShortcuts(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(app) === 'Shortcuts') {
      attributes = node.attributes.properties;
    }
    ts.forEachChild(node, findShortcuts);
  }
  findShortcuts(app);
  function expression(name) {
    const attribute = attributes?.find((item) => item.name?.getText(app) === name);
    return attribute?.initializer?.expression?.getText(app);
  }
  assert.equal(expression('suspended'), 'isIdle');
  assert.equal(expression('shortcutKeysEnabled'), 'shortcutKeysEnabled');
});

test('C039: 闲置态 Cmd/Ctrl + 1~6 不导航、不显示按键提示或反馈', () => {
  const harness = createKeyboardHarness({ suspended: true });
  harness.keydown('Meta', { metaKey: true });
  for (const modifier of ['metaKey', 'ctrlKey']) {
    for (const key of ['1', '2', '3', '4', '5', '6']) {
      assert.equal(harness.keydown(key, { [modifier]: true }), false);
      assert.equal(harness.location.href, 'about:blank');
    }
  }
  assert.equal(harness.state.isCmdPressed, false);
  assert.equal(harness.state.activeKeySiteId, null);
  assert.equal(harness.state.toastMessage, null);
});

test('C039: 闲置态数字快捷键不展开隐藏文件夹', () => {
  const harness = createKeyboardHarness({
    suspended: true,
    pageShortcuts: [{ id: 'folder', name: 'Folder', isFolder: true, children: [] }],
  });
  for (const modifier of ['metaKey', 'ctrlKey']) {
    assert.equal(harness.keydown('1', { [modifier]: true }), false);
  }
  assert.equal(harness.state.expandedFolderId, null);
  assert.equal(harness.state.toastMessage, null);
});

test('C039: 闲置态左右方向键不改变隐藏分页，也不拦截浏览器事件', () => {
  const harness = createKeyboardHarness({ suspended: true });
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    assert.equal(harness.keydown(key), false);
    assert.equal(harness.state.pageIndex, 1);
  }
});

test('C039: 活跃转闲置时移除监听并清除残留提示与激活反馈', () => {
  const harness = createKeyboardHarness();
  harness.keydown('1', { metaKey: true });
  assert.equal(harness.state.isCmdPressed, true);
  assert.equal(harness.state.activeKeySiteId, 'site-7');
  harness.render({ suspended: true });
  assert.equal(harness.listeners.get('keydown').size, 0);
  assert.equal(harness.listeners.get('keyup').size, 0);
  assert.equal(harness.listeners.get('blur').size, 0);
  assert.equal(harness.state.isCmdPressed, false);
  assert.equal(harness.state.activeKeySiteId, null);
});

test('C039: 唤醒后 Cmd/Ctrl + 数字恢复当前页映射及当前页面导航', () => {
  for (const modifier of ['metaKey', 'ctrlKey']) {
    const harness = createKeyboardHarness({ suspended: true });
    harness.render({ suspended: false });
    for (const key of ['1', '6']) {
      assert.equal(harness.keydown(key, { [modifier]: true }), true);
      assert.equal(harness.location.href, `https://site${Number(key) + 6}.example`);
      assert.equal(harness.state.activeKeySiteId, `site-${Number(key) + 6}`);
    }
  }
});

test('C039: 唤醒后方向键翻页与数字键展开文件夹恢复', () => {
  const harness = createKeyboardHarness({
    suspended: true,
    pageShortcuts: [{ id: 'folder', name: 'Folder', isFolder: true, children: [] }],
  });
  harness.render({ suspended: false });
  assert.equal(harness.keydown('ArrowRight'), true);
  assert.equal(harness.state.pageIndex, 2);
  assert.equal(harness.keydown('ArrowLeft'), true);
  assert.equal(harness.state.pageIndex, 1);
  assert.equal(harness.keydown('1', { metaKey: true }), true);
  assert.equal(harness.state.expandedFolderId, 'folder');
  assert.equal(harness.location.href, 'about:blank');
});

test('C039: 用户关闭网站快捷键后，唤醒仍保持关闭，方向键按原规则可用', () => {
  const harness = createKeyboardHarness({ suspended: true, shortcutKeysEnabled: false });
  harness.render({ suspended: false });
  for (const modifier of ['metaKey', 'ctrlKey']) {
    assert.equal(harness.keydown('1', { [modifier]: true }), false);
  }
  assert.equal(harness.location.href, 'about:blank');
  assert.equal(harness.state.isCmdPressed, false);
  assert.equal(harness.keydown('ArrowRight'), true);
  assert.equal(harness.state.pageIndex, 2);
});
