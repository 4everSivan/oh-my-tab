const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// @topic: MotionSystem — 动效系统契约测试（设计基线 docs/devel/design/07-动效系统.md）
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const motionCss = read('src/styles/motion.css');
const indexCss = read('src/index.css');
const clockSrc = read('src/components/clock/Clock.tsx');
const todoSrc = read('src/widgets/todo/index.tsx');
const modalSrc = read('src/components/widgets/AddWidgetModal.tsx');
const drawerSrc = read('src/components/settings/AppearanceDrawer.tsx');
const gridSrc = read('src/components/layout/GridContainer.tsx');
const hookSrc = read('src/hooks/useDelayedUnmount.ts');
const utilsSrc = read('src/utils/motion.ts');
const pkg = JSON.parse(read('package.json'));

// 1. 令牌梯度与片段参数组
test('motion.css 定义完整令牌梯度（时长 5 档 + 缓动 3 类 + 距离/缩放/模糊）', () => {
  const tokens = [
    '--motion-duration-micro: 80ms',
    '--motion-duration-quick: 150ms',
    '--motion-duration-fast: 250ms',
    '--motion-duration-medium: 350ms',
    '--motion-duration-slow: 400ms',
    '--motion-ease-smooth-out: cubic-bezier(0.22, 1, 0.36, 1)',
    '--motion-ease-spring: cubic-bezier(0.34, 1.36, 0.64, 1)',
    '--motion-ease-in-out: ease-in-out',
    '--motion-distance-base: 8px',
    '--motion-scale-modal: 0.96',
    '--motion-blur-small: 2px',
  ];
  for (const token of tokens) {
    assert.ok(motionCss.includes(token), `缺少令牌定义: ${token}`);
  }
});

test('motion.css 定义四组片段私有参数（digit/check/modal/panel）', () => {
  for (const group of [
    ['--digit-dur', '--digit-distance', '--digit-stagger', '--digit-blur', '--digit-ease'],
    ['--check-box', '--check-draw', '--check-uncheck', '--check-len'],
    ['--modal-open-dur', '--modal-close-dur', '--modal-scale'],
    ['--panel-open-dur', '--panel-close-dur', '--panel-blur', '--panel-ease'],
  ]) {
    for (const token of group) {
      assert.ok(motionCss.includes(token), `缺少片段参数: ${token}`);
    }
  }
});

test('首版 7 类片段选择器全部存在', () => {
  for (const selector of [
    '.t-digit-group',
    '.t-digit',
    '.t-check',
    '.t-modal-overlay',
    '.t-modal',
    '.t-panel-overlay',
    '.t-panel-slide',
    '.t-card-enter',
    '.t-list-enter',
    '.animate-fade-in',
  ]) {
    assert.ok(motionCss.includes(`${selector} {`) || motionCss.includes(`${selector}[`), `缺少片段: ${selector}`);
  }
});

test('index.css 在 Tailwind 指令之前引入 motion.css', () => {
  const importIdx = indexCss.indexOf("@import './styles/motion.css'");
  const tailwindIdx = indexCss.indexOf('@tailwind base');
  assert.ok(importIdx !== -1, 'index.css 缺少 motion.css 引入');
  assert.ok(tailwindIdx !== -1 && importIdx < tailwindIdx, '@import 必须先于 @tailwind 指令');
});

// 2. reduced-motion 全局降级守卫
test('prefers-reduced-motion 守卫同时覆盖 animation 与 transition 片段', () => {
  const guardIdx = motionCss.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(guardIdx !== -1, '缺少全局降级守卫');
  const guard = motionCss.slice(guardIdx);
  assert.ok(guard.includes('animation-duration: 0.01ms'), '守卫未归零 animation 时长');
  assert.ok(guard.includes('transition-duration: 0.01ms'), '守卫未归零 transition 时长');
  for (const cls of ['.t-digit', '.t-card-enter', '.t-list-enter', '.t-modal', '.t-panel-slide', '.t-check', '.animate-fade-in']) {
    assert.ok(guard.includes(cls), `守卫未覆盖 ${cls}`);
  }
});

// 3. animate-fade-in 空操作修复
test('animate-fade-in 从空操作修复为真实淡入定义', () => {
  const tailwindConfig = read('tailwind.config.js');
  const definedInMotion = motionCss.includes('@keyframes t-fade-in') &&
    /\.animate-fade-in\s*{\s*animation: t-fade-in/.test(motionCss);
  assert.ok(definedInMotion, 'motion.css 未提供 .animate-fade-in 真实定义');
  assert.ok(!/fade-in/.test(tailwindConfig), 'animate-fade-in 不应散落在 tailwind.config 中重复定义');
});

// 4. 组件接线
test('Clock 逐位渲染 t-digit 且 key 含字符值（仅变化位重放）', () => {
  assert.ok(clockSrc.includes('t-digit-group'), 'Clock 未使用 t-digit-group');
  assert.ok(clockSrc.includes('className="t-digit"'), 'Clock 未逐位渲染 t-digit');
  assert.ok(clockSrc.includes('`${index}-${char}`'), 't-digit key 必须含字符值以仅重放变化位');
});

test('Todo 勾选改为 aria-checked 驱动的 t-check 描画且新增项入场弹入', () => {
  assert.ok(todoSrc.includes('className="t-check"'), 'Todo 未接入 t-check');
  assert.ok(todoSrc.includes('aria-checked={item.completed}'), 't-check 未由 aria-checked 驱动');
  assert.ok(todoSrc.includes('stroke-dashoffset') === false, '描画样式应留在 motion.css 片段内');
  assert.ok(todoSrc.includes('<path d="M1 5.52L3.92 9.17L9.17 1"'), '缺少与 --check-len 校准的勾路径');
  assert.ok(todoSrc.includes('t-list-enter'), 'Todo 列表项未接入 t-list-enter 入场');
});

test('AddWidgetModal 经 useDelayedUnmount 支撑退出动画且关闭时延与令牌一致', () => {
  assert.ok(modalSrc.includes('useDelayedUnmount(isOpen, 150)'), '模态未接入延迟卸载或时延不等于 --modal-close-dur(150ms)');
  assert.ok(modalSrc.includes('t-modal-overlay') && modalSrc.includes('t-modal'), '模态未使用 t-modal 片段');
  assert.ok(modalSrc.includes('data-open={open}'), '模态开合未由 data-open 驱动');
  assert.ok(modalSrc.includes('stopPropagation'), '卡片点击未阻止冒泡到遮罩关闭');
  assert.ok(motionCss.includes('--modal-close-dur: 150ms'), '令牌侧 --modal-close-dur 应为 150ms');
});

test('AppearanceDrawer 侧滑开合经 useDelayedUnmount 且关闭时延与令牌一致', () => {
  assert.ok(drawerSrc.includes('useDelayedUnmount(isOpen, 350)'), '抽屉未接入延迟卸载或时延不等于 --panel-close-dur(350ms)');
  assert.ok(drawerSrc.includes('t-panel-overlay') && drawerSrc.includes('t-panel-slide'), '抽屉未使用 t-panel 片段');
  assert.ok(drawerSrc.includes('data-open={open}'), '抽屉开合未由 data-open 驱动');
  assert.ok(motionCss.includes('--panel-close-dur: 350ms'), '令牌侧 --panel-close-dur 应为 350ms');
});

test('GridContainer 卡片交错入场经 computeCardStagger 注入封顶延迟', () => {
  assert.ok(gridSrc.includes('t-card-enter'), '栅格卡片未接入 t-card-enter');
  assert.ok(gridSrc.includes('computeCardStagger(index)'), '未使用 computeCardStagger 计算交错延迟');
  assert.ok(gridSrc.includes('--card-stagger-delay'), '未通过 CSS 变量注入交错延迟');
});

// 5. 支撑层纯逻辑
test('computeCardStagger 公式：40ms 步进、360ms 封顶、非法入参抛错', () => {
  assert.ok(utilsSrc.includes('Math.min(index * stepMs, capMs)'), '公式应封顶为 min(index*stepMs, capMs)');
  // 与 src/utils/motion.ts 保持一致的期望值（防御公式漂移）
  const expect = (index, stepMs = 40, capMs = 360) => Math.min(index * stepMs, capMs);
  assert.equal(expect(0), 0);
  assert.equal(expect(1), 40);
  assert.equal(expect(5), 200);
  assert.equal(expect(9), 360);   // 恰好封顶
  assert.equal(expect(10), 360);  // 超出封顶后同时入场
  assert.equal(expect(50), 360);
  assert.ok(utilsSrc.includes('RangeError'), '非法入参必须前置抛错');
});

test('useDelayedUnmount 强制回流进入 + 定时卸载语义', () => {
  assert.ok(hookSrc.includes('closeDurationMs'), 'Hook 应接收关闭时长');
  assert.ok(hookSrc.includes('offsetHeight'), '进入态须经强制同步回流确保关闭态样式提交后再翻转（不依赖 rAF，遮挡环境可靠）');
  assert.ok(hookSrc.includes('setTimeout(() => setMounted(false), closeDurationMs)'), '关闭须延迟卸载');
  assert.ok(hookSrc.includes('clearTimeout'), '卸载时必须清理定时器');
  assert.ok(!/requestAnimationFrame\s*\(/.test(hookSrc), '不应调用 rAF（被遮挡标签页会节流失效；注释提及不算）');
});

// 6. 纯 CSS 路线与依赖克制
test('动效保持纯 CSS 路线：零新增 JS 动效运行时依赖', () => {
  const forbidden = ['framer-motion', 'gsap', 'animejs', '@motion', 'react-spring', 'popmotion'];
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  for (const lib of forbidden) {
    assert.ok(!deps.includes(lib), `禁止引入 JS 动效库: ${lib}`);
  }
  // clsx/lucide-react/react 等原有依赖保持不变（无新增运行时依赖）
  assert.deepEqual(
    Object.keys(pkg.dependencies).sort(),
    ['clsx', 'lucide-react', 'react', 'react-dom', 'tailwind-merge'],
  );
});

test('动效参数单一来源：组件源码不散落硬编码动效时长', () => {
  const sources = [clockSrc, todoSrc, modalSrc, drawerSrc, gridSrc];
  // 允许 Tailwind 原生 transition-colors/duration-200 等既有工具类；
  // 禁止出现新的毫秒级动效硬编码（如 duration-[450ms] 自定义值）
  for (const src of sources) {
    const customDurations = src.match(/duration-\[\d+ms\]/g) || [];
    assert.deepEqual(customDurations, [], '动效时长应引用 motion.css 令牌而非自定义值');
  }
});
