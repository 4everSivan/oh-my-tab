const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ── C030 修饰键组合方向键守卫：⌘+←/→ 交还浏览器原生页面前进/后退 ──────────────

const shortcutsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
  'utf8'
);

/** 从真实源码提取常用网站翻页的 keydown 处理器，断言针对实际发货逻辑而非镜像实现。 */
function extractFlipHandlerSource() {
  const section = shortcutsSrc.split('// 全局键盘左右方向键')[1];
  assert.ok(section, 'Shortcuts.tsx 必须保留「全局键盘左右方向键」翻页调度注释锚点');
  const block = section.split("window.addEventListener('keydown', handleKeyDown)")[0];
  const matched = block.match(
    /const handleKeyDown = \(e: KeyboardEvent\) => \{([\s\S]*?)\n    \};/
  );
  assert.ok(matched, '必须能从翻页调度块中提取 handleKeyDown 处理器源码');
  return matched[1];
}

const FLIP_HANDLER_SOURCE = extractFlipHandlerSource();

function createFlipHandler(options = {}) {
  const {
    totalPages = 3,
    pageIndex = 0,
    expandedFolderId = null,
    editableTarget = false,
  } = options;
  const pageUpdates = [];
  const folderUpdates = [];
  const sandbox = {
    isEditableElement: () => editableTarget,
    totalPages,
    expandedFolderId,
    setExpandedFolderId: (value) => folderUpdates.push(value),
    setPageIndex: (updater) =>
      pageUpdates.push(typeof updater === 'function' ? updater(pageIndex) : updater),
  };
  const handler = vm.runInNewContext(`(e) => {${FLIP_HANDLER_SOURCE}}`, sandbox);
  return { handler, pageUpdates, folderUpdates };
}

function dispatch(handler, key, modifiers = {}) {
  let prevented = false;
  handler({
    key,
    target: {},
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...modifiers,
    preventDefault: () => {
      prevented = true;
    },
  });
  return prevented;
}

test('C030: 纯方向键仍按既有契约翻页（T14 & C018 不回归）', () => {
  const next = createFlipHandler({ totalPages: 3, pageIndex: 0 });
  assert.equal(dispatch(next.handler, 'ArrowRight'), true, '纯 ArrowRight 必须拦截并翻页');
  assert.deepEqual(next.pageUpdates, [1], '纯 ArrowRight 必须切至下一页');

  const prev = createFlipHandler({ totalPages: 3, pageIndex: 2 });
  assert.equal(dispatch(prev.handler, 'ArrowLeft'), true, '纯 ArrowLeft 必须拦截并翻页');
  assert.deepEqual(prev.pageUpdates, [1], '纯 ArrowLeft 必须切至上一页');
});

test('C030: Command+方向键交还浏览器原生页面前进/后退，不翻页也不拦截', () => {
  for (const key of ['ArrowLeft', 'ArrowRight']) {
    const { handler, pageUpdates } = createFlipHandler({ totalPages: 3, pageIndex: 1 });
    assert.equal(dispatch(handler, key, { metaKey: true }), false, `⌘+${key} 严禁 preventDefault`);
    assert.deepEqual(pageUpdates, [], `⌘+${key} 严禁切换网站图标页`);
  }
});

test('C030: Ctrl / Alt / Shift 组合方向键同样让位（含 Alt+←/→ 前进后退与文本选择）', () => {
  for (const modifier of ['ctrlKey', 'altKey', 'shiftKey']) {
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      const { handler, pageUpdates } = createFlipHandler({ totalPages: 3, pageIndex: 1 });
      assert.equal(
        dispatch(handler, key, { [modifier]: true }),
        false,
        `${modifier}+${key} 严禁 preventDefault`
      );
      assert.deepEqual(pageUpdates, [], `${modifier}+${key} 严禁切换网站图标页`);
    }
  }
});

test('C030: 编辑与下拉选择聚焦态方向键一律不翻页', () => {
  const { handler, pageUpdates } = createFlipHandler({
    totalPages: 3,
    pageIndex: 1,
    editableTarget: true,
  });
  assert.equal(dispatch(handler, 'ArrowRight'), false, 'input/textarea/select 聚焦时严禁拦截方向键');
  assert.deepEqual(pageUpdates, []);
});

test('C030: Escape 收起文件夹抽屉的行为不受影响（含 Command+Escape）', () => {
  const { handler, folderUpdates } = createFlipHandler({ expandedFolderId: 'folder-1' });
  dispatch(handler, 'Escape', { metaKey: true });
  assert.deepEqual(folderUpdates, [null], '⌘+Escape 仍应收起已展开的文件夹抽屉');
});

test('C030: 单页场景保持不拦截方向键的既有行为', () => {
  const { handler, pageUpdates } = createFlipHandler({ totalPages: 1, pageIndex: 0 });
  assert.equal(dispatch(handler, 'ArrowRight'), false, '仅 1 页时不得无谓拦截方向键');
  assert.deepEqual(pageUpdates, []);
});

test('C030: 源码契约——修饰键守卫位于方向键分支之前且晚于 Escape 分支', () => {
  const guardIndex = shortcutsSrc.indexOf('e.metaKey || e.ctrlKey || e.altKey || e.shiftKey');
  const escapeIndex = shortcutsSrc.indexOf("e.key === 'Escape'");
  const rightIndex = shortcutsSrc.indexOf("e.key === 'ArrowRight'");
  const leftIndex = shortcutsSrc.indexOf("e.key === 'ArrowLeft'");

  assert.ok(guardIndex > -1, '必须声明 metaKey/ctrlKey/altKey/shiftKey 修饰键守卫');
  assert.ok(
    guardIndex < rightIndex && guardIndex < leftIndex,
    '守卫必须早于 ArrowRight / ArrowLeft 分支生效（C030 核心契约）'
  );
  assert.ok(escapeIndex < guardIndex, 'Escape 分支必须早于守卫，保证 ⌘+Escape 仍可收起文件夹');
  const firstPreventDefault = FLIP_HANDLER_SOURCE.indexOf('e.preventDefault()');
  const guardInHandler = FLIP_HANDLER_SOURCE.indexOf('e.metaKey');
  assert.ok(
    firstPreventDefault === -1 || (guardInHandler > -1 && guardInHandler < firstPreventDefault),
    'e.preventDefault() 调用只能出现在修饰键守卫之后'
  );
  assert.ok(
    FLIP_HANDLER_SOURCE.includes('isEditableElement(e.target)'),
    '输入态守卫必须复用 isEditableElement（覆盖 select）'
  );
  assert.ok(!FLIP_HANDLER_SOURCE.includes('tagName'), '输入态守卫不得回退为内联 tagName 判断');
});
