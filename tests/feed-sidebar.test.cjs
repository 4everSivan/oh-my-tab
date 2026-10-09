const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── T17 独立订阅消息侧边栏与外观设置解耦 ──────────────────────────────

const feedSidebarSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'feed', 'FeedSidebar.tsx'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'App.tsx'),
  'utf8'
);
const hookSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'hooks', 'useKeyboardShortcuts.ts'),
  'utf8'
);

test('T17: FeedSidebar.tsx 独立抽屉组件与分类筛选契约', () => {
  // 1. 核心导出
  assert.ok(
    feedSidebarSrc.includes('export const FeedSidebar'),
    'FeedSidebar.tsx 必须导出 FeedSidebar 组件'
  );
  assert.ok(
    feedSidebarSrc.includes('export interface FeedItem'),
    'FeedSidebar.tsx 必须导出 FeedItem 类型'
  );

  // 2. 动效集成
  assert.ok(
    feedSidebarSrc.includes('useDelayedUnmount'),
    'FeedSidebar 必须使用 useDelayedUnmount 支撑平滑滑出退出动画'
  );
  assert.ok(
    feedSidebarSrc.includes('t-panel-overlay') && feedSidebarSrc.includes('t-panel-slide'),
    'FeedSidebar 必须接入统一动效令牌 t-panel-overlay 与 t-panel-slide'
  );

  // 3. 分类标签筛选
  assert.ok(
    feedSidebarSrc.includes("setFeedCategory(cat.id)") || feedSidebarSrc.includes("setFeedCategory"),
    'FeedSidebar 必须提供分类切换状态'
  );
  assert.ok(
    feedSidebarSrc.includes('github') && feedSidebarSrc.includes('tech') && feedSidebarSrc.includes('blog') && feedSidebarSrc.includes('todo'),
    '分类列表必须包含 GitHub、科技、博客、待办'
  );

  // 4. 一键全部已读与未读计数
  assert.ok(
    feedSidebarSrc.includes('onMarkAllRead'),
    'FeedSidebar 必须支持 onMarkAllRead 全部已读回调'
  );
  assert.ok(
    feedSidebarSrc.includes('unreadCount === 0'),
    '全部已读按钮在未读数为 0 时必须禁用'
  );
});

test('T17: App.tsx 顶栏右上角双胶囊按钮分离与未读呼吸角标', () => {
  // 1. 🔔 订阅消息与 ⚙️ 外观设置按钮独立呈现
  assert.ok(
    appSrc.includes('<Bell'),
    'App 顶栏必须呈现独立的 Bell 铃铛订阅消息按钮'
  );
  assert.ok(
    appSrc.includes('<SlidersHorizontal'),
    'App 顶栏必须呈现独立的 SlidersHorizontal 外观设置按钮'
  );

  // 2. 呼吸红色未读角标
  assert.ok(
    appSrc.includes('unreadCount > 0'),
    '未读数大于 0 时必须呈现角标'
  );
  assert.ok(
    appSrc.includes('animate-pulse') && appSrc.includes('bg-rose-500'),
    '未读角标必须带有 animate-pulse 呼吸动效与高辨识度玫瑰红背景'
  );
});

test('T17: 订阅消息侧边栏与外观设置抽屉交互互斥彻底解耦', () => {
  // 1. 互斥点击逻辑
  assert.ok(
    appSrc.includes('setIsFeedSidebarOpen((prev) => !prev)') && appSrc.includes('setIsDrawerOpen(false)'),
    '点击 🔔 展开订阅侧边栏时必须自动关闭外观设置抽屉'
  );
  assert.ok(
    appSrc.includes('setIsDrawerOpen((prev) => !prev)') && appSrc.includes('setIsFeedSidebarOpen(false)'),
    '点击 ⚙️ 展开外观设置抽屉时必须自动关闭订阅侧边栏'
  );

  // 2. Escape 键级联关闭优先级
  assert.ok(
    appSrc.includes('if (isFeedSidebarOpen) {') && appSrc.includes('setIsFeedSidebarOpen(false);'),
    'handleCloseTopLayer 必须优先拦截并关闭订阅消息侧边栏'
  );
});

test('T17: useKeyboardShortcuts 支持按 b 键快速唤起/关闭订阅消息侧边栏', () => {
  assert.ok(
    hookSrc.includes("onToggleFeedSidebar?: () => void"),
    'UseKeyboardShortcutsOptions 必须声明 onToggleFeedSidebar'
  );
  assert.ok(
    hookSrc.includes("e.key === 'b' && onToggleFeedSidebar"),
    'useKeyboardShortcuts 必须监听 b 键触发 onToggleFeedSidebar'
  );
});
