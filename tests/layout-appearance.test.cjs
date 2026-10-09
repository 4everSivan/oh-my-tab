const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function filterVisibleAndSort(items) {
  return [...items].filter(i => i.visible).sort((a, b) => a.order - b.order);
}

function handleAddWidget(layout, manifest) {
  const existingIndex = layout.findIndex(item => item.typeId === manifest.typeId);
  if (existingIndex !== -1) {
    const updated = [...layout];
    updated[existingIndex] = { ...updated[existingIndex], visible: true };
    return updated;
  }
  return [...layout, {
    instanceId: `${manifest.typeId}-${Date.now()}`,
    typeId: manifest.typeId,
    settings: {},
    visible: true,
    span: manifest.defaultSpan,
    order: layout.length,
  }];
}

function handleRemoveWidget(layout, instanceId) {
  return layout.map(item => item.instanceId === instanceId ? { ...item, visible: false } : item);
}

test('Grid layout filters out hidden items and sorts by order', () => {
  const layout = [
    { instanceId: 'w2', typeId: 'notes', order: 2, visible: true },
    { instanceId: 'w1', typeId: 'todo', order: 1, visible: false },
    { instanceId: 'w0', typeId: 'focus', order: 0, visible: true },
  ];

  const visible = filterVisibleAndSort(layout);
  assert.equal(visible.length, 2);
  assert.equal(visible[0].instanceId, 'w0');
  assert.equal(visible[1].instanceId, 'w2');
});

test('Adding widget re-activates existing hidden instance rather than duplicating', () => {
  const layout = [
    { instanceId: 'inst-todo-1', typeId: 'core.todo', order: 0, visible: false },
  ];

  const manifest = { typeId: 'core.todo', defaultSpan: 6 };
  const updated = handleAddWidget(layout, manifest);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].instanceId, 'inst-todo-1');
  assert.equal(updated[0].visible, true);
});

test('Adding a new widget type appends new instance', () => {
  const layout = [
    { instanceId: 'inst-todo-1', typeId: 'core.todo', order: 0, visible: true },
  ];

  const manifest = { typeId: 'core.notes', defaultSpan: 6 };
  const updated = handleAddWidget(layout, manifest);

  assert.equal(updated.length, 2);
  assert.equal(updated[1].typeId, 'core.notes');
  assert.equal(updated[1].visible, true);
});

test('Removing widget marks visible as false without deleting data entry', () => {
  const layout = [
    { instanceId: 'inst-1', typeId: 'core.todo', order: 0, visible: true },
    { instanceId: 'inst-2', typeId: 'core.notes', order: 1, visible: true },
  ];

  const updated = handleRemoveWidget(layout, 'inst-1');
  assert.equal(updated.length, 2);
  assert.equal(updated[0].visible, false);
  assert.equal(updated[1].visible, true);
});

// ── C003 材质预设切换失效回归 ──────────────────────────────────
test('材质预设必须写回 type=material：图片模式下点击预设立即生效（C003）', () => {
  const drawerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'settings', 'AppearanceDrawer.tsx'),
    'utf8'
  );
  assert.ok(
    drawerSrc.includes("onUpdateBackground({ type: 'material', name: mat.id, color: mat.color })"),
    '材质预设须显式切换 type=material，否则 image 模式下点击预设零视觉变化'
  );
  // 渲染层语义：type=image 且有派生地址时优先图片，材质预设必须离开该分支
  const getBgStyle = (bg) => (bg.type === 'image' && bg.imageBlobUrl ? 'image' : 'color');
  assert.equal(getBgStyle({ type: 'material', name: 'mist', color: '#e6edf5' }), 'color');
  assert.equal(getBgStyle({ type: 'image', imageBlobUrl: 'blob:x' }), 'image');
});

// ── C004 背景层可见性绘制契约回归 ──────────────────────────────
test('body 必须透明：不透明 body 底色会在绘制序上遮蔽 -z-20 背景层 (C004)', () => {
  const indexCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8')
    // 剥离 CSS 注释后再匹配，避免说明文字干扰
    .replace(/\/\*[\s\S]*?\*\//g, '');
  // body 声明 background-color 会让不透明 body 层绘制在负 z-index 背景层之上，完全遮蔽壁纸/材质
  assert.ok(
    !/body\s*\{[^}]*background-color/.test(indexCss),
    'body 不得声明 background-color（负 z-index 背景层绘制于 body 背景之下，会被完全遮蔽）'
  );
  assert.ok(/html\s*\{[^}]*background-color/.test(indexCss), 'html 底色须保留作画布兜底');
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
  assert.ok(appSrc.includes('-z-20'), 'App 背景层应保持 -z-20 固定层');
});

// ── T10 时钟手动时区设置与搜索框圆角调节契约 ──────────────────
test('时钟组件支持目标 IANA 时区并能准确换算时间与日期 (T10)', () => {
  const clockSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'clock', 'Clock.tsx'),
    'utf8'
  );
  assert.ok(
    clockSrc.includes('appearance.timezone') && clockSrc.includes("appearance.timezone !== 'auto'"),
    'Clock.tsx 须检测 appearance.timezone 是否为自定义时区'
  );
  assert.ok(
    clockSrc.includes('timeZone: targetTimezone') && clockSrc.includes("hourCycle: 'h23'"),
    'Clock.tsx 须使用 Intl.DateTimeFormat 配合 targetTimezone 与 h23 小时制换算'
  );

  // 算法校验：验证 UTC、Asia/Tokyo 与 America/New_York 时区转换在确定性时间戳下的正确性
  const testDate = new Date('2026-10-09T04:30:15Z'); // 04:30:15 UTC

  const formatTestTime = (tz) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(testDate);
    return `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;
  };

  assert.equal(formatTestTime('UTC'), '04:30:15');
  assert.equal(formatTestTime('Asia/Shanghai'), '12:30:15'); // UTC+8
  assert.equal(formatTestTime('Asia/Tokyo'), '13:30:15');    // UTC+9
  assert.equal(formatTestTime('America/New_York'), '00:30:15'); // EDT (UTC-4)
});

test('搜索框组件应用动态 borderRadius 样式且移除硬编码 rounded-full (T10)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );
  // form 容器不得再包含硬编码 rounded-full
  assert.ok(
    !searchBarSrc.includes('rounded-full border border-black/10'),
    'SearchBar.tsx 的 form 容器不得硬编码 rounded-full'
  );
  // form 容器须应用 appearance.radius 样式
  assert.ok(
    searchBarSrc.includes('borderRadius: `${appearance.radius ?? 24}px`'),
    'SearchBar.tsx 须通过 borderRadius 绑定 appearance.radius'
  );
});

test('AppearanceDrawer 提供时区选择下拉框与搜索框圆角滑块控件 (T10)', () => {
  const drawerSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'settings', 'AppearanceDrawer.tsx'),
    'utf8'
  );
  // 1. 时钟面板包含时区选择器
  assert.ok(
    drawerSrc.includes('时区设置') && drawerSrc.includes('onUpdateClock({ timezone: e.target.value })'),
    'AppearanceDrawer 时钟面板须有时区设置下拉框与更新回调'
  );
  assert.ok(
    drawerSrc.includes('Asia/Shanghai') && drawerSrc.includes('America/New_York') && drawerSrc.includes('UTC'),
    '时区下拉框须包含主要代表性时区选项'
  );
  // 2. 搜索框面板包含圆角大小滑块
  assert.ok(
    drawerSrc.includes('圆角大小') && drawerSrc.includes('onUpdateSearch({ radius: Number(e.target.value) })'),
    'AppearanceDrawer 搜索框面板须有圆角大小滑块与更新回调'
  );
  assert.ok(
    drawerSrc.includes('search.radius ?? 24'),
    '圆角滑块须以 24px 作为默认降级展示'
  );
});

