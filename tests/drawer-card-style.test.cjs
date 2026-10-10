const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── C023 抽屉卡片样式、分栏标题防折行与顶栏添加组件纯图标化 ────────────────

const drawerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'settings', 'AppearanceDrawer.tsx'),
  'utf8'
);
const feedSidebarSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'feed', 'FeedSidebar.tsx'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'App.tsx'),
  'utf8'
);
const motionCss = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'styles', 'motion.css'),
  'utf8'
);

test('C023: AppearanceDrawer Tab 导航采用 Segmented Control 且防折行', () => {
  // 1. 分段控制容器
  assert.ok(
    drawerSrc.includes('grid grid-cols-4') && drawerSrc.includes('rounded-xl'),
    'AppearanceDrawer 必须使用 grid-cols-4 分段控件样式'
  );

  // 2. 精简标题与 whitespace-nowrap
  assert.ok(
    drawerSrc.includes('whitespace-nowrap'),
    'Tab 按钮必须声明 whitespace-nowrap 防止多行断字'
  );
  assert.ok(drawerSrc.includes('<span>时钟</span>'), 'Tab 必须采用精简标题「时钟」');
  assert.ok(drawerSrc.includes('<span>搜索</span>'), 'Tab 必须采用精简标题「搜索」');
  assert.ok(drawerSrc.includes('<span>壁纸</span>'), 'Tab 必须采用精简标题「壁纸」');
  assert.ok(drawerSrc.includes('<span>快捷键</span>'), 'Tab 必须采用精简标题「快捷键」');

  // 3. 彻底移除旧易折行标题
  assert.ok(!drawerSrc.includes('<span>时间与日期</span>'), '必须移除易折行的长标题「时间与日期」');
  assert.ok(!drawerSrc.includes('<span>搜索框</span>'), '必须移除旧标题「搜索框」');
  assert.ok(!drawerSrc.includes('<span>壁纸与背景</span>'), '必须移除易折行的长标题「壁纸与背景」');
  assert.ok(!drawerSrc.includes('<span>快捷键与导航</span>'), '必须移除易折行的长标题「快捷键与导航」');
});

test('C023: 主页顶栏添加组件按钮调整为纯图标胶囊，移除文字描述', () => {
  assert.ok(
    appSrc.includes('title="添加组件 (a)"'),
    '添加组件按钮必须声明 title="添加组件 (a)" 辅助提示'
  );
  assert.ok(
    !appSrc.includes('<span>添加组件</span>'),
    '添加组件按钮必须移除 <span>添加组件</span> 文字，保持纯图标'
  );
  assert.ok(
    appSrc.includes('p-2 rounded-full'),
    '添加组件按钮必须采用与其他顶栏按钮一致的 p-2 rounded-full 规格'
  );
});

const addWidgetModalSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'widgets', 'AddWidgetModal.tsx'),
  'utf8'
);
const shortcutsModalSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'ShortcutsHelpModal.tsx'),
  'utf8'
);

test('C023: AppearanceDrawer 与 FeedSidebar 统一采用悬浮圆角卡片抽屉样式', () => {
  // 1. AppearanceDrawer 悬浮卡片与边距
  assert.ok(
    drawerSrc.includes('p-3 sm:p-4') && drawerSrc.includes('overflow-hidden'),
    'AppearanceDrawer 外层遮罩必须具备 p-3 sm:p-4 间隙与 overflow-hidden'
  );
  assert.ok(
    drawerSrc.includes('rounded-2xl sm:rounded-3xl'),
    'AppearanceDrawer 面板卡片必须具备 rounded-2xl sm:rounded-3xl 大圆角'
  );
  assert.ok(
    drawerSrc.includes('border border-black/10 dark:border-white/10'),
    'AppearanceDrawer 必须具备四周完整边框'
  );

  // 2. FeedSidebar 悬浮卡片与边距
  assert.ok(
    feedSidebarSrc.includes('p-3 sm:p-4') && feedSidebarSrc.includes('overflow-hidden'),
    'FeedSidebar 外层遮罩必须具备 p-3 sm:p-4 间隙与 overflow-hidden'
  );
  assert.ok(
    feedSidebarSrc.includes('rounded-2xl sm:rounded-3xl'),
    'FeedSidebar 面板卡片必须具备 rounded-2xl sm:rounded-3xl 大圆角'
  );
  assert.ok(
    feedSidebarSrc.includes('border border-black/10 dark:border-white/10'),
    'FeedSidebar 必须具备四周完整边框'
  );

  // 3. motion.css 侧滑彻底移出视口
  assert.ok(
    motionCss.includes('transform: translateX(calc(100% + 2rem))'),
    'motion.css .t-panel-slide 必须支持 translateX(calc(100% + 2rem)) 完全移出边距'
  );
});

test('C023: AddWidgetModal 与 ShortcutsHelpModal 统一采用右侧悬浮圆角卡片抽屉样式且互斥', () => {
  // 1. AddWidgetModal 样式与延迟
  assert.ok(
    addWidgetModalSrc.includes('t-panel-overlay') && addWidgetModalSrc.includes('t-panel-slide'),
    'AddWidgetModal 必须接入右侧抽屉滑动类名'
  );
  assert.ok(
    addWidgetModalSrc.includes('p-3 sm:p-4') && addWidgetModalSrc.includes('rounded-2xl sm:rounded-3xl'),
    'AddWidgetModal 必须具备 p-3 sm:p-4 间隙与 rounded-2xl sm:rounded-3xl 大圆角'
  );
  assert.ok(
    addWidgetModalSrc.includes('useDelayedUnmount(isOpen, 350)'),
    'AddWidgetModal 必须使用 350ms 抽屉延迟'
  );

  // 2. ShortcutsHelpModal 样式与延迟
  assert.ok(
    shortcutsModalSrc.includes('t-panel-overlay') && shortcutsModalSrc.includes('t-panel-slide'),
    'ShortcutsHelpModal 必须接入右侧抽屉滑动类名'
  );
  assert.ok(
    shortcutsModalSrc.includes('p-3 sm:p-4') && shortcutsModalSrc.includes('rounded-2xl sm:rounded-3xl'),
    'ShortcutsHelpModal 必须具备 p-3 sm:p-4 间隙与 rounded-2xl sm:rounded-3xl 大圆角'
  );
  assert.ok(
    shortcutsModalSrc.includes('useDelayedUnmount(isOpen, 350)'),
    'ShortcutsHelpModal 必须使用 350ms 抽屉延迟'
  );

  // 3. 顶栏 4 个抽屉按钮具备互斥开合逻辑与激活状态高亮圈
  assert.ok(appSrc.includes('isHelpOpen ? \'ring-2'), '快捷键按钮应具备激活状态 ring 高亮圈');
  assert.ok(appSrc.includes('isAddModalOpen ? \'ring-2'), '添加组件按钮应具备激活状态 ring 高亮圈');
  assert.ok(appSrc.includes('isFeedSidebarOpen ? \'ring-2'), '订阅侧边栏按钮应具备激活状态 ring 高亮圈');
  assert.ok(appSrc.includes('isDrawerOpen ? \'ring-2'), '外观设置按钮应具备激活状态 ring 高亮圈');
});

test('C023: AppearanceDrawer 具备统一图标与副标题，且顶栏四大按钮触碰展示名称提示', () => {
  // 1. AppearanceDrawer 标题左侧具备 SlidersHorizontal 独立图标容器与副标题
  assert.ok(
    drawerSrc.includes('SlidersHorizontal') && drawerSrc.includes('p-1.5 rounded-lg bg-black/5 dark:bg-white/10'),
    'AppearanceDrawer 标题左侧必须包含 SlidersHorizontal 图标容器'
  );
  assert.ok(
    drawerSrc.includes('个性化布局与视觉风格 · 实时预览即时生效'),
    'AppearanceDrawer 必须包含统一的说明副标题'
  );

  // 2. FeedSidebar 同样具备副标题与图标对齐
  assert.ok(
    feedSidebarSrc.includes('全网资讯聚合 · 即时追踪动态'),
    'FeedSidebar 必须包含统一的说明副标题'
  );

  // 3. 顶栏四大按钮触碰展示名称与快捷键徽标 (topbar-tooltip)
  assert.ok(appSrc.includes('topbar-tooltip'), '顶栏按钮必须包含 topbar-tooltip 浮动提示容器');
  assert.ok(appSrc.includes('className="tooltip-text">快捷键指南</span>'), '快捷键指南按钮必须具备悬浮名称提示');
  assert.ok(appSrc.includes('className="tooltip-text">添加组件</span>'), '添加组件按钮必须具备悬浮名称提示');
  assert.ok(appSrc.includes('className="tooltip-text">订阅消息</span>'), '订阅消息按钮必须具备悬浮名称提示');
  assert.ok(appSrc.includes('className="tooltip-text">外观设置</span>'), '外观设置按钮必须具备悬浮名称提示');
  assert.ok(appSrc.includes('group-hover:opacity-100'), '提示框必须在触碰/hover 时平滑淡入展示');
});
