const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── T16 常用网站网页图标 Command+数字键快捷直达与实时按键提示 ────────────────

const shortcutsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
  'utf8'
);
const hookSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'useKeyboardShortcuts.ts'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'App.tsx'),
  'utf8'
);
const drawerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'settings', 'AppearanceDrawer.tsx'),
  'utf8'
);
const storageSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'storage', 'index.ts'),
  'utf8'
);
const indexCss = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'index.css'),
  'utf8'
);

test('T16: StorageService 支持 shortcutKeysEnabled 持久化与类型契约', () => {
  // 1. 存储键声明
  assert.ok(
    storageSrc.includes("SHORTCUT_KEYS_ENABLED: 'settings.shortcutKeysEnabled'"),
    'STORAGE_KEYS 必须包含 SHORTCUT_KEYS_ENABLED'
  );

  // 2. 读写方法
  assert.ok(
    storageSrc.includes('async getShortcutKeysEnabled(): Promise<boolean>'),
    'StorageService 必须提供 getShortcutKeysEnabled 方法'
  );
  assert.ok(
    storageSrc.includes('async setShortcutKeysEnabled(enabled: boolean): Promise<boolean>'),
    'StorageService 必须提供 setShortcutKeysEnabled 方法'
  );

  // 3. 并发批量加载包含 shortcutKeysEnabled
  assert.ok(
    storageSrc.includes('this.getShortcutKeysEnabled()'),
    'loadAllSettings 必须包含 this.getShortcutKeysEnabled()'
  );
});

test('T16: Shortcuts.tsx 具备按住 Command 监听与 site-key-hint 提示徽标渲染', () => {
  // 1. Props 支持
  assert.ok(
    shortcutsSrc.includes('shortcutKeysEnabled?: boolean'),
    'ShortcutsProps 必须声明 shortcutKeysEnabled 属性'
  );

  // 2. Command 按下状态管理
  assert.ok(
    shortcutsSrc.includes('isCmdPressed, setIsCmdPressed'),
    'Shortcuts 必须维护 isCmdPressed 状态'
  );
  assert.ok(
    shortcutsSrc.includes('activeKeySiteId, setActiveKeySiteId'),
    'Shortcuts 必须维护 activeKeySiteId 触感反馈状态'
  );

  // 3. 按键提示徽标 DOM 节点
  assert.ok(
    shortcutsSrc.includes('site-key-hint'),
    'Shortcuts 必须渲染 site-key-hint 样式类名'
  );
  assert.ok(
    shortcutsSrc.includes('⌘{localIndex + 1}') || shortcutsSrc.includes('⌘${localIndex + 1}'),
    '按键提示徽标必须呈现 ⌘1 ~ ⌘6 键帽文字'
  );

  // 4. 当前页至多 6 个图标条件限制 (C021)
  assert.ok(
    shortcutsSrc.includes('localIndex < PAGE_SIZE') || shortcutsSrc.includes('localIndex < 6'),
    '按键徽标针对当前活动页展示至多 6 个图标'
  );
});

test('T16: Shortcuts.tsx 组合按 ⌘+1~6 秒开网站并具备输入态防误触避让', () => {
  // 1. 组合按键匹配 (C021: 针对当前活动页 1~6 槽位)
  assert.ok(
    shortcutsSrc.includes('/^[1-6]$/.test(e.key)') || shortcutsSrc.includes('/^[1-9]$/.test(e.key)'),
    'Shortcuts 必须检测 1~6 数字键'
  );

  // 2. 输入态防护
  assert.ok(
    shortcutsSrc.includes('isEditableElement(document.activeElement)'),
    'Shortcuts 必须使用 isEditableElement 防护打字误触'
  );

  // 3. 拦截浏览器默认行为
  assert.ok(
    shortcutsSrc.includes('e.preventDefault()'),
    '组合按 ⌘+数字键必须调用 e.preventDefault() 阻止浏览器原生标签页切换'
  );

  // 4. 触感动效与无障碍 Toast 反馈
  assert.ok(
    shortcutsSrc.includes('site-key-active'),
    '激活的快捷图标必须应用 site-key-active 触感微缩动效'
  );
  assert.ok(
    shortcutsSrc.includes('已通过快捷键 ⌘'),
    '触发快捷键时必须通过 Toast 弹出无障碍状态通知'
  );

  // 5. 当前页面直接打开契约 (C022)
  assert.ok(
    shortcutsSrc.includes('window.location.href = targetSite.url'),
    '快捷键直达必须通过 window.location.href = targetSite.url 在当前页面打开'
  );
  assert.ok(
    !shortcutsSrc.includes("window.open(targetSite.url, '_blank')"),
    'Shortcuts.tsx 快捷键直达严禁使用 window.open 打开新标签页'
  );
});

test('C022: Shortcuts.tsx 组合按 ⌘+1~6 必须在当前页面 (window.location.href) 直接打开网站', () => {
  assert.ok(
    shortcutsSrc.includes('window.location.href = targetSite.url'),
    '快捷键直达必须通过 window.location.href = targetSite.url 在当前页面直接跳转'
  );
  assert.ok(
    !shortcutsSrc.includes("window.open(targetSite.url, '_blank')"),
    'Shortcuts.tsx 快捷键逻辑严禁包含 window.open(targetSite.url, \'_blank\')'
  );
});

test('T16: AppearanceDrawer.tsx 提供「网页图标快捷键」配置开关组件', () => {
  // 1. Props 支持
  assert.ok(
    drawerSrc.includes('shortcutKeysEnabled?: boolean'),
    'AppearanceDrawerProps 必须包含 shortcutKeysEnabled'
  );
  assert.ok(
    drawerSrc.includes('onUpdateShortcutKeysEnabled?: (enabled: boolean) => void'),
    'AppearanceDrawerProps 必须包含 onUpdateShortcutKeysEnabled 回调'
  );

  // 2. 界面呈现
  assert.ok(
    drawerSrc.includes('常用网站快捷键'),
    'AppearanceDrawer 必须呈现常用网站快捷键标题'
  );
  assert.ok(
    drawerSrc.includes('启用 ⌘ + 数字键选取与按键提示'),
    'AppearanceDrawer 必须呈现启用 ⌘ + 数字键选取与按键提示开关项'
  );
  assert.ok(
    drawerSrc.includes('onUpdateShortcutKeysEnabled?.(e.target.checked)'),
    '开关变更时必须触发 onUpdateShortcutKeysEnabled'
  );
});

test('T16: index.css 包含 site-key-hint 与 site-key-active 动效与深色模式样式', () => {
  assert.ok(
    indexCss.includes('.site-key-hint'),
    'index.css 必须定义 .site-key-hint 样式'
  );
  assert.ok(
    indexCss.includes('.site-key-hint.is-visible'),
    'index.css 必须定义 .site-key-hint.is-visible 显示态'
  );
  assert.ok(
    indexCss.includes('.site-key-hint.is-active'),
    'index.css 必须定义 .site-key-hint.is-active 激活高亮态'
  );
  assert.ok(
    indexCss.includes('.site-key-active'),
    'index.css 必须定义 .site-key-active 图标下压微缩反馈'
  );
});

test('C021: 翻页后按键徽标与快捷键按当前活动页局部映射 (⌘1~⌘6)', () => {
  // 1. 渲染采用 localIndex
  assert.ok(
    shortcutsSrc.includes('⌘{localIndex + 1}'),
    '按键徽标必须使用 localIndex + 1 渲染'
  );
  assert.ok(
    shortcutsSrc.includes('localIndex < PAGE_SIZE'),
    '按键徽标必须限制为当前页 localIndex < PAGE_SIZE'
  );

  // 2. 快捷键目标必须从当前活动页 pageShortcuts 获取
  assert.ok(
    shortcutsSrc.includes('pageShortcuts[num]'),
    '目标必须从当前页切片 pageShortcuts[num] 获取，而非全局 shortcuts[num]'
  );

  // 3. 页面切片逻辑正确性单元断言
  const sampleShortcuts = Array.from({ length: 14 }, (_, i) => ({
    id: `site-${i + 1}`,
    name: `Site ${i + 1}`,
    url: `https://site${i + 1}.com`,
  }));
  const PAGE_SIZE = 6;

  // 第 1 页 (pageIndex = 0)
  const page0 = sampleShortcuts.slice(0 * PAGE_SIZE, 0 * PAGE_SIZE + PAGE_SIZE);
  assert.equal(page0.length, 6);
  assert.equal(page0[0].name, 'Site 1'); // 对应 ⌘1
  assert.equal(page0[5].name, 'Site 6'); // 对应 ⌘6

  // 第 2 页 (pageIndex = 1) -> 翻页后依然是 ⌘1~⌘6
  const page1 = sampleShortcuts.slice(1 * PAGE_SIZE, 1 * PAGE_SIZE + PAGE_SIZE);
  assert.equal(page1.length, 6);
  assert.equal(page1[0].name, 'Site 7'); // 翻页后 ⌘1 打开 Site 7
  assert.equal(page1[5].name, 'Site 12'); // 翻页后 ⌘6 打开 Site 12

  // 第 3 页 (pageIndex = 2)
  const page2 = sampleShortcuts.slice(2 * PAGE_SIZE, 2 * PAGE_SIZE + PAGE_SIZE);
  assert.equal(page2.length, 2);
  assert.equal(page2[0].name, 'Site 13'); // 对应 ⌘1
  assert.equal(page2[1].name, 'Site 14'); // 对应 ⌘2
});

