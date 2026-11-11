const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── T20 首页极简化与启动台改版 ─────────────────────────────────────────

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
const motionCss = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'styles', 'motion.css'),
  'utf8'
);
const indexCss = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'index.css'),
  'utf8'
);

test('T20: 左上角无文字启动台入口与 L 键开关接线', () => {
  assert.ok(appSrc.includes('aria-label="启动台 (l)"'), '顶栏左上角须渲染启动台图标按钮');
  assert.ok(appSrc.includes('<Grid3X3'), '启动台入口须使用 3×3 网格图标');
  assert.ok(appSrc.includes('isLaunchpadOpen'), 'App 须管理启动台开关状态');
  assert.ok(appSrc.includes('<Launchpad'), 'App 须挂载 Launchpad 组件');
  assert.ok(appSrc.includes('onToggleLaunchpad'), 'App 须接入 L 键启动台开关');
  assert.ok(hookSrc.includes("e.key.toLowerCase() === 'l'"), '全局快捷键须支持 L 打开/关闭启动台');
  assert.ok(!appSrc.includes('tracking-wider uppercase'), '左上角不得再渲染品牌文字');
});

test('T20: 启动台以 data-open 承载淡入淡出与可交互性', () => {
  assert.ok(shortcutsSrc.includes('launchpad-overlay'), '启动台须使用 launchpad-overlay 浮层');
  assert.ok(shortcutsSrc.includes("data-open={isOpen ? 'true' : 'false'}"), '启动台须以 data-open 控制开合');
  assert.ok(shortcutsSrc.includes('launchpad-backdrop'), '启动台须渲染背景模糊遮罩');
  assert.ok(shortcutsSrc.includes('launchpad-shell'), '启动台内容须使用 launchpad-shell 收束过渡');
  assert.ok(motionCss.includes('.launchpad-overlay[data-open=\'true\']'), 'motion.css 须定义启动台打开态');
  assert.ok(motionCss.includes('280ms'), '启动台淡入淡出须为 280ms 量级');
  assert.ok(motionCss.includes('.launchpad-shell'), 'motion.css 须定义启动台内容收束');
});

test('T20: 启动台按名称过滤、响应式网格与空结果状态', () => {
  assert.ok(shortcutsSrc.includes('const [query, setQuery]'), '启动台须维护名称过滤 query');
  assert.ok(shortcutsSrc.includes('filteredShortcuts'), '启动台须按 query 过滤网站列表');
  assert.ok(shortcutsSrc.includes('aria-label="搜索网站"'), '启动台须提供过滤搜索框');
  assert.ok(shortcutsSrc.includes('没有找到匹配的网站'), '过滤无结果时须展示空状态');
  assert.ok(shortcutsSrc.includes('grid-cols-3'), '窄窗口须为 3 列网格');
  assert.ok(shortcutsSrc.includes('sm:grid-cols-4'), '小窗口须为 4 列网格');
  assert.ok(shortcutsSrc.includes('md:grid-cols-6'), '中窗口须为 6 列网格');
  assert.ok(shortcutsSrc.includes('lg:grid-cols-8'), '桌面须为 8 列网格');
  assert.ok(shortcutsSrc.includes('w-[68px] h-[68px]'), '桌面图标须为 68px 连续圆角方形');
});

test('T20: 启动台保留网站/文件夹管理、导入导出与拖拽排序', () => {
  assert.ok(shortcutsSrc.includes('handleOpenAdd'), '须保留添加网站入口');
  assert.ok(shortcutsSrc.includes('editingShortcut'), '须保留编辑网站弹窗');
  assert.ok(shortcutsSrc.includes('expandedFolder'), '须保留文件夹面板');
  assert.ok(shortcutsSrc.includes('handleContextMenu'), '须保留右键菜单');
  assert.ok(shortcutsSrc.includes('exportShortcutsToJSON'), '须保留导出能力');
  assert.ok(shortcutsSrc.includes('parseShortcutsFromJSON'), '须保留导入能力');
  assert.ok(shortcutsSrc.includes('handleDragStart') && shortcutsSrc.includes('handleDropIntoFolder'), '须保留拖拽排序与移入文件夹');
  assert.ok(shortcutsSrc.includes('createPortal'), '弹窗与浮层须继续经 createPortal 挂载至 document.body');
});

test('T20: 首页单排 6 图标、分页、方向键/滚轮翻页与数字快捷键彻底移除', () => {
  assert.ok(!/<Shortcuts[\s>]/.test(appSrc), '首页不得再直接渲染旧的单排网站组件');
  assert.ok(!shortcutsSrc.includes('PAGE_SIZE'), '不得再保留每页 6 图标常量');
  assert.ok(!shortcutsSrc.includes('pageShortcuts'), '不得再保留当前页切片');
  assert.ok(!shortcutsSrc.includes('totalPages'), '不得再保留分页状态');
  assert.ok(!shortcutsSrc.includes('onWheel={handleWheel}'), '不得再保留滚轮翻页');
  assert.ok(!shortcutsSrc.includes('ArrowRight'), '不得再保留方向键翻页');
  assert.ok(!shortcutsSrc.includes('site-key-hint'), '不得再保留 Command 按键提示徽标');
  assert.ok(!shortcutsSrc.includes('isCmdPressed'), '不得再保留 Command 按键状态');
  assert.ok(!shortcutsSrc.includes('/^[1-6]$/'), '不得再保留 ⌘+1~6 数字快捷键');
  assert.ok(!shortcutsSrc.includes('已通过快捷键 ⌘'), '不得再保留数字快捷键 Toast');
  assert.ok(!indexCss.includes('.site-key-hint'), 'index.css 不得残留 site-key-hint 样式');

  assert.ok(!storageSrc.includes('SHORTCUT_KEYS_ENABLED'), '存储层不得再保留网站快捷键开关');
  assert.ok(!storageSrc.includes('getShortcutKeysEnabled'), '存储层不得再读取网站快捷键开关');
  assert.ok(!drawerSrc.includes('shortcutKeysEnabled'), '外观设置不得再包含网站快捷键开关');
  assert.ok(!drawerSrc.includes('常用网站快捷键'), '外观设置不得再包含网站快捷键说明');
});

test('T20: 大时钟、时间收起与闲置模式彻底移除', () => {
  assert.ok(!appSrc.includes('ClockAppearance'), 'App 不得再持有大时钟外观');
  assert.ok(!appSrc.includes('useIdleDetection'), 'App 不得再引入闲置检测');
  assert.ok(!appSrc.includes('isCollapsed'), 'App 不得再保留折叠模式');
  assert.ok(!appSrc.includes('data-idle'), '页面不得再输出闲置属性');
  assert.ok(!storageSrc.includes('settings.idle'), '存储层不得再保留 idle 键');
  assert.ok(!storageSrc.includes('settings.clock'), '存储层不得再保留 clock 键');
  assert.ok(!motionCss.includes('t-idle'), 'motion.css 不得残留闲置样式');
  assert.ok(!motionCss.includes('workspace-container'), 'motion.css 不得残留折叠容器');
  assert.ok(!drawerSrc.includes('闲置'), '外观设置不得再出现闲置配置');
  assert.ok(!hookSrc.includes('suspended'), '快捷键 Hook 不得再保留闲置挂起开关');
  assert.ok(!hookSrc.includes("e.key === 'c'"), '不得再保留 C 键折叠快捷键');
});

test('T20: 小钟固定在搜索框左上方且无钟表图标', () => {
  assert.ok(appSrc.includes('ClockLine'), 'App 须渲染 ClockLine 小钟');
  assert.ok(appSrc.includes('topSlot={'), '小钟须经 SearchBar topSlot 与搜索框共用对齐容器');
  assert.ok(appSrc.includes('clockContainerRef'), '小钟须保留自适应取色采样引用');
  assert.ok(!appSrc.includes('onToggleCollapse'), '小钟不得再承担点击收起交互');
  assert.ok(appSrc.includes('打开启动台'), '页脚须提示 L 打开启动台');
});
