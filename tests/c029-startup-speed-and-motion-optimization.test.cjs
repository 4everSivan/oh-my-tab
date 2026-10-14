/**
 * C029: 新标签页启动速度与加载动效性能优化回归测试
 * 验证：
 * 1. 入场动效 GPU 合成器硬件加速：t-digit-pop-in、t-stagger-rise 与 t-card-enter-in 消除 filter:blur 动态插值；
 * 2. 动效节奏提速：数字弹入 240ms、卡片 260ms、常用网站 240ms 紧凑轻快；
 * 3. index.html 首屏预渲染：默认底色 style 杜绝冷启动白屏；
 * 4. main.tsx 同步 bootCache 背景注入：首屏 0ms 呈现真实配置底色；
 * 5. App.tsx 异步代码分割与空闲预热：四大非首屏抽屉通过 React.lazy 动态拆分，配合 Suspense 渲染；
 * 6. App.tsx 启动比对优化：bootCache 命中时跳过无损全树 Re-render，非关键 RSS 抓取延后。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const motionCss = read('src/styles/motion.css');
const indexHtml = read('index.html');
const mainTsx = read('src/main.tsx');
const appSrc = read('src/App.tsx');
const contrastHookSrc = read('src/hooks/useAdaptiveContrast.ts');

test('C029: 入场动效关键帧彻底移除 filter:blur 动态插值，锁定 GPU 合成器硬件加速', () => {
  // 1. t-digit-pop-in 关键帧只包含 transform 与 opacity，不包含 filter: blur
  const digitMatch = motionCss.match(/@keyframes\s+t-digit-pop-in\s*\{([\s\S]*?)\n\}/);
  assert.ok(digitMatch, '必须包含 @keyframes t-digit-pop-in');
  assert.ok(!digitMatch[1].includes('filter: blur'), 't-digit-pop-in 关键帧严禁包含 filter: blur 强制光栅化重绘');
  assert.ok(digitMatch[1].includes('transform: translateY'), 't-digit-pop-in 必须保持 transform 硬件加速');
  assert.ok(digitMatch[1].includes('opacity: 0') && digitMatch[1].includes('opacity: 1'), 't-digit-pop-in 必须保持 opacity');

  // 2. t-stagger-rise 关键帧只包含 transform 与 opacity
  const staggerMatch = motionCss.match(/@keyframes\s+t-stagger-rise\s*\{([\s\S]*?)\n\}/);
  assert.ok(staggerMatch, '必须包含 @keyframes t-stagger-rise');
  assert.ok(!staggerMatch[1].includes('filter: blur'), 't-stagger-rise 关键帧严禁包含 filter: blur 避免与 backdrop-blur 冲突');

  // 3. t-card-enter-in 关键帧只包含 transform 与 opacity
  const cardMatch = motionCss.match(/@keyframes\s+t-card-enter-in\s*\{([\s\S]*?)\n\}/);
  assert.ok(cardMatch, '必须包含 @keyframes t-card-enter-in');
  assert.ok(!cardMatch[1].includes('filter: blur'), 't-card-enter-in 关键帧严禁包含 filter: blur');
});

test('C029: 动效时长梯度提速至 240ms~260ms，消除拖沓感', () => {
  // 数字弹入时长时间收紧至 240ms
  assert.ok(motionCss.includes('--digit-dur: 240ms;'), '--digit-dur 必须优化为 240ms');

  // 卡片入场收紧至 260ms
  assert.ok(motionCss.includes('--card-enter-dur: 260ms;'), '--card-enter-dur 必须优化为 260ms');

  // 常用网站级联入场收紧至 240ms
  assert.ok(motionCss.includes('animation: t-stagger-rise 240ms'), 't-stagger-item 动画时长必须优化为 240ms');
});

test('C029: index.html 与 main.tsx 具备 0ms 背景预置与同步 bootCache 注入，杜绝冷启动白屏', () => {
  // index.html 预置背景样式
  assert.ok(indexHtml.includes('background-color: #f5f4ef'), 'index.html 必须内置默认底色以防冷启动白屏闪烁');

  // main.tsx 同步 bootCache 背景注入
  assert.ok(mainTsx.includes('oh_my_tab_boot_cache'), 'main.tsx 必须读取 oh_my_tab_boot_cache');
  assert.ok(
    mainTsx.includes('document.documentElement.style.backgroundColor'),
    'main.tsx 必须在 React 首帧挂载前同步设置背景色'
  );
});

test('C029: App.tsx 对四大抽屉与模态实施 React.lazy 异步分包与空闲预热', () => {
  // lazy 动态导入
  assert.ok(
    appSrc.includes("lazy(() =>\n  import('./components/settings/AppearanceDrawer')") ||
    appSrc.includes("import('./components/settings/AppearanceDrawer')"),
    'AppearanceDrawer 必须按需异步代码分割'
  );
  assert.ok(
    appSrc.includes("import('./components/feed/FeedSidebar')"),
    'FeedSidebar 必须按需异步代码分割'
  );
  assert.ok(
    appSrc.includes("import('./components/widgets/AddWidgetModal')"),
    'AddWidgetModal 必须按需异步代码分割'
  );
  assert.ok(
    appSrc.includes("import('./components/shortcuts/ShortcutsHelpModal')"),
    'ShortcutsHelpModal 必须按需异步代码分割'
  );

  // Suspense 包装
  assert.ok(appSrc.includes('<Suspense fallback={null}>'), '抽屉与模态必须包裹在 Suspense 中');

  // 空闲预热机制
  assert.ok(
    appSrc.includes('requestIdleCallback') || appSrc.includes('preload'),
    'App 必须在挂载后空闲预热非关键浮层 chunk'
  );
});

test('C029: 消除启动首帧全树二次 Re-render 与非关键网络争抢', () => {
  // loadAllSettings 深度比对防二次渲染
  assert.ok(
    appSrc.includes('JSON.stringify(c) !== JSON.stringify(boot?.clock)'),
    'loadAll 必须比对 clock 配置一致性以跳过冗余 setState'
  );
  assert.ok(
    appSrc.includes('JSON.stringify(s) !== JSON.stringify(boot?.search)'),
    'loadAll 必须比对 search 配置一致性以跳过冗余 setState'
  );
  assert.ok(
    appSrc.includes('JSON.stringify(finalBackground) !== JSON.stringify(boot?.background)'),
    'loadAll 必须比对 background 配置一致性以跳过冗余 setState'
  );

  // useAdaptiveContrast 防重渲染
  assert.ok(
    contrastHookSrc.includes('prev.clock.textColor === clockRes.color') ||
    contrastHookSrc.includes('prev.clock.tone === clockRes.tone'),
    'useAdaptiveContrast 必须比对前序计算结果，数值未变时跳过 setResult'
  );
});

test('C029 缺陷修复与坚守：index.html 维持 body 透明契约且 App.tsx 确保壁纸 Blob 挂载上屏', () => {
  // 1. index.html body 透明保障
  const bodyMatch = indexHtml.match(/body\s*\{([^}]*)\}/i);
  assert.ok(bodyMatch, 'index.html 必须声明 body 样式');
  assert.ok(
    bodyMatch[1].includes('background-color: transparent'),
    'index.html 内的 body 必须声明 background-color: transparent，避免遮蔽 -z-20 壁纸层 (C004)'
  );

  // 2. App.tsx 在 b.type === image 时确保更新 background 挂载最新会话 Blob URL
  assert.ok(
    appSrc.includes("b.type === 'image' || JSON.stringify(finalBackground) !== JSON.stringify(boot?.background)"),
    'loadAll 必须在图片模式下无条件挂载由 IndexedDB 恢复出的最新会话 Blob URL'
  );

  // 3. handleUpdateBackground 具备切回图片模式时恢复 wallpaper 的能力
  assert.ok(
    appSrc.includes("updates.type === 'image' || (!updates.type && background.type === 'image')"),
    'handleUpdateBackground 必须支持在切换为 image 类型时自动恢复壁纸 Blob'
  );
});
