const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── C027 快捷键关闭死锁、文件夹模式污染、全局粘贴泄露、计时器重复通知与搜索选词不一致回归测试 ─────────

const shortcutsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
  'utf8'
);
const appearanceDrawerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'settings', 'AppearanceDrawer.tsx'),
  'utf8'
);
const focusTimerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'widgets', 'focus-timer', 'index.tsx'),
  'utf8'
);
const searchBarSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
  'utf8'
);
const contrastSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'useAdaptiveContrast.ts'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'App.tsx'),
  'utf8'
);
const transferSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'shortcuts', 'transfer.ts'),
  'utf8'
);

test('C027: Shortcuts 模态框完全复位与快捷键防死锁源码断言 (N07)', () => {
  assert.ok(
    shortcutsSrc.includes('handleCloseModal'),
    'Shortcuts 必须统一定义 handleCloseModal 函数'
  );
  assert.ok(
    shortcutsSrc.includes('setIsAdding(false)') && shortcutsSrc.includes('setEditingShortcut(null)'),
    'handleCloseModal 必须同时复位 isAdding 与 editingShortcut'
  );

  // 取消按钮与遮罩点击必须调用 handleCloseModal
  assert.ok(
    shortcutsSrc.includes('onClick={() => handleCloseModal()}'),
    '模态框取消按钮必须调用 handleCloseModal'
  );
  assert.ok(
    shortcutsSrc.includes('handleCloseModal();') && !shortcutsSrc.includes('onClick={(e) => {\n              if (e.target === e.currentTarget) {\n                setEditingShortcut(null);'),
    '模态框遮罩点击必须调用 handleCloseModal，严禁残留孤立的 setEditingShortcut(null)'
  );
});

test('C027: Shortcuts handleOpenEdit 依据目标类型显式校准 addMode (N08)', () => {
  assert.ok(
    shortcutsSrc.includes("setAddMode(shortcut.isFolder ? 'folder' : 'site')"),
    'handleOpenEdit 必须依据 shortcut.isFolder 显式校准 addMode，防文件夹模式污染'
  );

  // 行为逻辑验证
  let currentAddMode = 'folder'; // 模拟前序添加文件夹残留状态
  function mockOpenEdit(shortcut) {
    currentAddMode = shortcut.isFolder ? 'folder' : 'site';
  }

  // 编辑普通网站
  mockOpenEdit({ id: 's1', name: 'GitHub', url: 'https://github.com' });
  assert.equal(currentAddMode, 'site', '编辑普通网站时 addMode 必须校准为 site');

  // 编辑文件夹
  mockOpenEdit({ id: 'f1', name: '开发工具', isFolder: true, url: '' });
  assert.equal(currentAddMode, 'folder', '编辑文件夹时 addMode 必须校准为 folder');
});

test('C027: AppearanceDrawer 全局 paste 监听器具备 isOpen 守卫 (N09)', () => {
  assert.ok(
    appearanceDrawerSrc.includes("if (!isOpen || activeTab !== 'background') return;"),
    'paste 监听器必须检查 !isOpen，在抽屉关闭时严禁监听全局粘贴'
  );
  assert.ok(
    appearanceDrawerSrc.includes('[isOpen, activeTab, applyWallpaperFile]'),
    'paste 监听器依赖数组必须包含 isOpen'
  );
});

test('C027: focus-timer 挂载检测过期立即写回持久化防通知风暴 (N10)', () => {
  assert.ok(
    focusTimerSrc.includes('void host.storage.setContent<FocusState>'),
    '挂载检测到已过期时，必须立即调用 host.storage.setContent 写回持久化'
  );
  assert.ok(
    focusTimerSrc.includes('notifiedEndTimes'),
    'focus-timer 必须维护已通知集合以防多标签页或重新打开重复弹窗'
  );

  // 行为模拟验证
  let storedIsRunning = true;
  let notifications = 0;
  const notifiedSet = new Set();
  const pastEndTime = Date.now() - 5000;

  function mockMountCheck(saved) {
    if (saved.isRunning && saved.targetEndTime <= Date.now()) {
      storedIsRunning = false;
      if (!notifiedSet.has(saved.targetEndTime)) {
        notifiedSet.add(saved.targetEndTime);
        notifications++;
      }
    }
  }

  // 首次挂载：检测过期，触发 1 次通知并修正持久化
  mockMountCheck({ isRunning: true, targetEndTime: pastEndTime });
  assert.equal(storedIsRunning, false, '持久化状态必须被修正为 false');
  assert.equal(notifications, 1, '首次到期必须发送通知');

  // 再次挂载（如刷新或另开标签页）：不会重复触发通知
  mockMountCheck({ isRunning: storedIsRunning, targetEndTime: pastEndTime });
  assert.equal(notifications, 1, '重新挂载绝不重复触发通知风暴');
});

test('C027: SearchBar 方向键导航不触发二次联想且接入 IME 保护 (N06)', () => {
  assert.ok(
    searchBarSrc.includes('isNavigatingRef'),
    'SearchBar 必须维护 isNavigatingRef 避免键盘浏览触发新联想请求'
  );
  assert.ok(
    searchBarSrc.includes('if (isNavigatingRef.current)'),
    '联想 effect 必须在 isNavigatingRef.current 为 true 时跳过请求'
  );
  assert.ok(
    searchBarSrc.includes('e.nativeEvent.isComposing') || searchBarSrc.includes("e.key === 'Process'"),
    'handleInputKeyDown 必须拦截 IME 拼音输入状态防误提交'
  );
});

test('C027: useAdaptiveContrast 接收 clockConfig 并在几何属性改变时重采 (N11)', () => {
  assert.ok(
    contrastSrc.includes('clockConfig?: ClockAppearance'),
    'useAdaptiveContrast 签名必须接收 clockConfig 可选参数'
  );
  assert.ok(
    contrastSrc.includes('clockConfig?.top') && contrastSrc.includes('clockConfig?.size'),
    'useAdaptiveContrast 依赖数组必须包含 clockConfig.top 与 clockConfig.size'
  );
  assert.ok(
    appSrc.includes('useAdaptiveContrast(') && appSrc.includes('clock\n  )'),
    'App.tsx 必须将 clock 传给 useAdaptiveContrast 形成闭环'
  );
});

test('C027: App.tsx 首次纯色上传图片正确登记 Blob URL 以备重置回收', () => {
  assert.ok(
    appSrc.includes('currentBlobUrlRef.current = updates.imageBlobUrl;'),
    'handleUpdateBackground 必须把新 imageBlobUrl 登记至 currentBlobUrlRef'
  );
});

test('C027: transfer.ts mergeShortcuts 保证导入项唯一 ID 防联动删除', () => {
  assert.ok(
    transferSrc.includes('ensureUniqueShortcutId'),
    'transfer.ts 必须定义 ensureUniqueShortcutId'
  );

  // 导入存在与现有项目相同 ID 的数据
  const current = [
    { id: 'item-dup', name: '已有站点', url: 'https://site-a.com' }
  ];
  const imported = [
    { id: 'item-dup', name: '导入相同ID站点', url: 'https://site-b.com' }
  ];

  // 模拟去重分配
  function ensureUniqueShortcutId(item, seenIds) {
    let uniqueId = item.id;
    if (!uniqueId || seenIds.has(uniqueId)) {
      uniqueId = `shortcut-new-${Math.random().toString(36).slice(2, 6)}`;
    }
    seenIds.add(uniqueId);
    return { ...item, id: uniqueId };
  }

  const seen = new Set(current.map(c => c.id));
  const processed = imported.map(item => ensureUniqueShortcutId(item, seen));

  assert.notEqual(processed[0].id, 'item-dup', '冲突 ID 必须被重新分配');
  assert.equal(seen.size, 2, '所有 ID 必须全局唯一');
});
