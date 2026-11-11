/**
 * C040 回归：交互动效打磨、搜索联想可读性、启动台去底色遮罩与背景模糊设置。
 * 行为断言直接 require 真实发货模块（经 helpers/load-ts 即时转译），
 * 样式与接线断言读取 motion.css 与组件源码。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('./helpers/load-ts.cjs');

const root = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const motionCss = read('src/styles/motion.css');
const appSrc = read('src/App.tsx');
const searchBarSrc = read('src/components/search/SearchBar.tsx');
const launchpadSrc = read('src/components/shortcuts/Shortcuts.tsx');
const drawerSrc = read('src/components/settings/AppearanceDrawer.tsx');
const feedSrc = read('src/components/feed/FeedSidebar.tsx');

/** 取某个选择器（精确匹配整段选择器文本）的声明块内容 */
function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `motion.css 缺少规则 ${selector}`);
  return match[1];
}

// ── 1. 搜索联想可读性 ─────────────────────────────────────────

test('C040: 下拉面板底色不透明度与模糊有下限，不再随搜索框透明度变透明', () => {
  const { resolveSearchPanelStyle, PANEL_MIN_ALPHA, PANEL_MIN_BLUR } = require('../src/utils/searchPanel.ts');
  // 搜索框调到完全透明、模糊为 0：面板仍须保持下限
  const transparent = resolveSearchPanelStyle('dark', 0, 0);
  assert.equal(transparent.backgroundColor, `rgba(255, 255, 255, ${PANEL_MIN_ALPHA})`);
  assert.ok(transparent.backdropFilter.includes(`blur(${PANEL_MIN_BLUR}px)`));
  // 搜索框比下限更实、更糊时沿用用户设置
  const solid = resolveSearchPanelStyle('dark', 1, 24);
  assert.equal(solid.backgroundColor, 'rgba(255, 255, 255, 1)');
  assert.ok(solid.backdropFilter.includes('blur(24px)'));
  // 非法输入不产生 NaN 样式
  const broken = resolveSearchPanelStyle('light', Number.NaN, Number.NaN);
  assert.ok(!broken.backgroundColor.includes('NaN') && !broken.backdropFilter.includes('NaN'));
});

test('C040: 面板底色随字色取同向色，最坏壁纸下文字对比度仍 ≥ 7:1', () => {
  const { resolveSearchPanelStyle } = require('../src/utils/searchPanel.ts');
  const { contrastRatio, parseHex } = require('../src/utils/contrast.ts');
  const composite = (rgba, behind) => {
    const [r, g, b, a] = rgba.match(/[\d.]+/g).map(Number);
    return [r, g, b].map((c, i) => c * a + behind[i] * (1 - a));
  };
  // 浅字（深色背景）→ 深色面板；最坏情况是面板后方恰为纯白
  const light = resolveSearchPanelStyle('light', 0, 0);
  assert.ok(light.backgroundColor.startsWith('rgba(24, 26, 30'), '浅字场景须使用深色面板');
  const lightRatio = contrastRatio(parseHex(light.textColor), composite(light.backgroundColor, [255, 255, 255]));
  assert.ok(lightRatio >= 7, `浅字面板最坏对比度 ${lightRatio.toFixed(2)} 不足 7:1`);
  // 深字（浅色背景）→ 浅色面板；最坏情况是面板后方恰为纯黑
  const dark = resolveSearchPanelStyle('dark', 0, 0);
  const darkRatio = contrastRatio(parseHex(dark.textColor), composite(dark.backgroundColor, [0, 0, 0]));
  assert.ok(darkRatio >= 7, `深字面板最坏对比度 ${darkRatio.toFixed(2)} 不足 7:1`);
});

test('C040: 候选词拆分为已输入部分与补全部分', () => {
  const { splitSuggestionText } = require('../src/utils/searchPanel.ts');
  assert.deepEqual(splitSuggestionText('react hooks', 'rea'), { typed: 'rea', completion: 'ct hooks' });
  assert.deepEqual(splitSuggestionText('React Hooks', ' rea '), { typed: 'Rea', completion: 'ct Hooks' });
  assert.deepEqual(splitSuggestionText('天气预报', 'tianqi'), { typed: '', completion: '天气预报' });
  assert.deepEqual(splitSuggestionText('anything', ''), { typed: '', completion: 'anything' });
});

test('C040: SearchBar 联想面板与引擎菜单接入可读性样式，不再写死深灰字色', () => {
  assert.ok(searchBarSrc.includes('resolveSearchPanelStyle(tone, opacity, blurPx)'));
  assert.ok(searchBarSrc.includes('splitSuggestionText(item.text, rawQueryRef.current)'));
  assert.ok(!searchBarSrc.includes('text-stone-700 dark:text-stone-300'), '联想项不得再写死深灰字色');
  assert.ok(!searchBarSrc.includes('text-stone-700 dark:text-stone-200'), '引擎菜单项不得再写死深灰字色');
  // 两个下拉面板都使用 panelStyle，搜索框本体仍按用户透明度设置渲染
  assert.equal(searchBarSrc.match(/style=\{panelStyle\}/g)?.length, 2);
  assert.ok(searchBarSrc.includes('backgroundColor: `rgba(255, 255, 255, ${opacity})`'));
  assert.ok(searchBarSrc.includes('role="listbox"') && searchBarSrc.includes('role="option"'));
});

// ── 2. 启动台：去底色遮罩 + 背景模糊设置 ───────────────────────

test('C040: 启动台背景层只做模糊，不叠加任何底色', () => {
  const backdrop = ruleBody(motionCss, '.launchpad-backdrop');
  assert.ok(!/background(-color)?\s*:/.test(backdrop), '.launchpad-backdrop 不得再声明 background 底色');
  assert.ok(backdrop.includes('backdrop-filter: blur(var(--launchpad-blur))'));
  assert.ok(!motionCss.includes('.dark .launchpad-backdrop'), '暗色底色遮罩规则须一并移除');
  assert.ok(!/launchpad-backdrop[^"]*bg-/.test(launchpadSrc), '组件侧不得用工具类补回底色');
});

test('C040: 启动台背景模糊半径解析——缺省回落默认、越界钳制、0 合法', () => {
  const { resolveLaunchpadBlur } = require('../src/utils/background.ts');
  const { DEFAULT_LAUNCHPAD_BLUR, LAUNCHPAD_BLUR_MAX, DEFAULT_BACKGROUND_CONFIG } = require('../src/services/storage/types.ts');
  assert.equal(DEFAULT_BACKGROUND_CONFIG.launchpadBlur, DEFAULT_LAUNCHPAD_BLUR);
  assert.equal(resolveLaunchpadBlur(undefined), DEFAULT_LAUNCHPAD_BLUR);
  assert.equal(resolveLaunchpadBlur({}), DEFAULT_LAUNCHPAD_BLUR, '旧版存储无该字段时按默认值');
  assert.equal(resolveLaunchpadBlur({ launchpadBlur: Number.NaN }), DEFAULT_LAUNCHPAD_BLUR);
  assert.equal(resolveLaunchpadBlur({ launchpadBlur: 0 }), 0, '0 表示完全不模糊，不得被当作缺省');
  assert.equal(resolveLaunchpadBlur({ launchpadBlur: 12 }), 12);
  assert.equal(resolveLaunchpadBlur({ launchpadBlur: -5 }), 0);
  assert.equal(resolveLaunchpadBlur({ launchpadBlur: 999 }), LAUNCHPAD_BLUR_MAX);
});

test('C040: 启动台背景模糊随背景配置持久化，并随「恢复材质默认」复位', async () => {
  const { StorageService } = require('../src/services/storage/index.ts');
  const { DEFAULT_LAUNCHPAD_BLUR } = require('../src/services/storage/types.ts');
  const store = new Map();
  const adapter = {
    get: async (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    set: async (key, value) => void store.set(key, JSON.parse(JSON.stringify(value))),
    remove: async (key) => void store.delete(key),
    clear: async () => store.clear(),
  };
  const service = new StorageService(adapter, {});
  const updated = await service.setBackground({ launchpadBlur: 8 });
  assert.equal(updated.launchpadBlur, 8);
  assert.equal((await service.getBackground()).launchpadBlur, 8, '刷新后须保留');
  assert.equal(store.get('settings.background').shade, 35, '只改模糊不得影响其他背景字段');
  const reset = await service.resetBackground();
  assert.equal(reset.launchpadBlur, DEFAULT_LAUNCHPAD_BLUR);
});

test('C040: 启动台把模糊半径注入 CSS 变量，外观抽屉提供滑块', () => {
  assert.ok(launchpadSrc.includes("'--launchpad-blur': `${resolveLaunchpadBlur(background)}px`"));
  assert.ok(drawerSrc.includes('启动台背景模糊'));
  assert.ok(drawerSrc.includes('onUpdateBackground({ launchpadBlur: Number(e.target.value) })'));
  assert.ok(drawerSrc.includes('max={LAUNCHPAD_BLUR_MAX}'));
  assert.ok(drawerSrc.includes('grid grid-cols-2'), '外观设置仍为搜索/壁纸两段，不新增分段');
});

// ── 3. 启动台切换动效 ─────────────────────────────────────────

test('C040: 启动台根容器不做透明度过渡，背景层/内容层各自淡入淡出', () => {
  const overlay = ruleBody(motionCss, '.launchpad-overlay');
  assert.ok(!/opacity/.test(overlay), '根容器 opacity<1 会让背景模糊在淡入期间失效，须改为分层过渡');
  assert.ok(/visibility:\s*hidden/.test(overlay));
  assert.ok(/opacity:\s*0/.test(ruleBody(motionCss, '.launchpad-backdrop')));
  assert.ok(/opacity:\s*1/.test(ruleBody(motionCss, ".launchpad-overlay[data-open='true'] .launchpad-backdrop")));
  const shell = ruleBody(motionCss, '.launchpad-shell');
  assert.ok(/opacity:\s*0/.test(shell) && shell.includes('scale(var(--launchpad-scale-from))'));
  assert.ok(!/will-change/.test(shell), '内容层不得常驻 will-change，避免图标毛玻璃失去背景');
  assert.ok(/--launchpad-open-dur:\s*280ms/.test(motionCss) && /--launchpad-close-dur:\s*200ms/.test(motionCss), '开 280ms / 关 200ms');
});

test('C040: 启动台打开时首页各层淡出，且只动 opacity', () => {
  assert.ok(appSrc.includes("data-launchpad-open={isLaunchpadOpen ? 'true' : 'false'}"));
  assert.ok((appSrc.match(/home-layer/g) || []).length >= 4, '顶栏、小钟、组件区、页脚须标记 home-layer');
  assert.ok(searchBarSrc.includes('home-layer search-field'), '搜索框本体须标记 home-layer');
  const covered = ruleBody(motionCss, "[data-launchpad-open='true'] .home-layer");
  assert.ok(/opacity:\s*0/.test(covered));
  assert.ok(!/transform/.test(covered) && !/transform/.test(ruleBody(motionCss, '.home-layer')), '首页层不得使用 transform（fixed 搜索区的包含块会被改变）');
});

test('C040: 启动台每次打开重放图标级联，延迟封顶', () => {
  assert.ok(/animation:\s*none/.test(ruleBody(motionCss, ".launchpad-overlay[data-open='false'] .t-stagger-item")));
  assert.ok(motionCss.includes(".launchpad-overlay[data-open='true'] .t-stagger-item"));
  assert.ok(launchpadSrc.includes('computeCardStagger(localIndex, 18, 216)'));
  assert.ok(!launchpadSrc.includes('* 35}ms'), '不得再使用无封顶的 35ms 线性延迟');
  const { computeCardStagger } = require('../src/utils/motion.ts');
  assert.equal(computeCardStagger(3, 18, 216), 54);
  assert.equal(computeCardStagger(80, 18, 216), 216, '图标再多，级联总延迟也不超过 216ms');
});

// ── 4. 其余交互动效片段与接线 ─────────────────────────────────

test('C040: motion.css 定义新增片段并纳入 reduced-motion 守卫', () => {
  for (const cls of ['.t-popover', ".t-popover[data-open='true']", '.t-pop-in', '.t-dialog-in', '.t-tab-in', '.t-icon-swap']) {
    assert.ok(motionCss.includes(`${cls} {`), `motion.css 缺少 ${cls}`);
  }
  for (const name of ['t-pop-in-rise', 't-dialog-in-rise', 't-tab-in-rise', 't-icon-swap-in']) {
    const frames = motionCss.match(new RegExp(`@keyframes ${name}\\s*\\{[\\s\\S]*?\\n\\}`));
    assert.ok(frames, `缺少 @keyframes ${name}`);
    assert.ok(!frames[0].includes('filter'), `${name} 关键帧只允许 transform/opacity (C029)`);
  }
});

test('C040: reduced-motion 守卫取消运动但保留淡入淡出，不再把时长归零', () => {
  const mediaIdx = motionCss.indexOf('@media (prefers-reduced-motion: reduce)');
  const guard = motionCss.slice(motionCss.indexOf('{', mediaIdx) + 1);
  const blocks = [...guard.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({ selectors: m[1], body: m[2] }));
  const fade = blocks.find((b) => b.body.includes('animation-name: t-fade-in'));
  assert.ok(fade, '入场关键帧须替换为纯淡入 t-fade-in');
  for (const cls of ['.t-digit', '.t-card-enter', '.t-list-enter', '.t-stagger-item', '.t-toast', '.t-pop-in', '.t-dialog-in', '.t-tab-in', '.t-icon-swap', '.animate-fade-in']) {
    assert.ok(fade.selectors.includes(cls), `淡入替换未覆盖 ${cls}`);
  }
  assert.ok(!/animation-duration|animation-delay/.test(fade.body), '保留原时长与级联延迟');
  const still = blocks.find((b) => /transform:\s*none/.test(b.body));
  assert.ok(still && /filter:\s*none/.test(still.body));
  for (const cls of ['.t-modal', '.t-panel-slide', '.origin-menu', '.t-popover', '.launchpad-shell']) {
    assert.ok(still.selectors.includes(cls), `开合过渡未取消运动: ${cls}`);
  }
  assert.ok(!/transition-duration/.test(still.body), '开合过渡保留原时长，由 opacity 完成交叉淡化');
  const instant = blocks.find((b) => b.body.includes('transition-duration: 0.01ms'));
  assert.ok(instant && instant.selectors.includes('.t-tabs-sliding') && instant.selectors.includes('.t-check'));
  for (const cls of ['.t-modal', '.t-panel-slide', '.t-popover', '.liquid-glass-surface', '.launchpad']) {
    assert.ok(!instant.selectors.includes(cls), `${cls} 不得被归零为瞬跳`);
  }
});

test('C040: 搜索区浮层接入开合动效', () => {
  assert.ok(searchBarSrc.includes('useDelayedUnmount(suggestionsVisible, 120)'), '联想面板须播放退出过渡后再卸载');
  assert.ok(searchBarSrc.includes('className="t-popover '));
  assert.ok(searchBarSrc.includes('useDelayedUnmount(showEngineMenu, 200)'), '引擎菜单须播放 origin-menu 退出过渡');
  assert.ok(searchBarSrc.includes("data-open={engineMenu.open ? 'true' : 'false'}"));
  assert.ok(searchBarSrc.includes('<span key={currentEngine.id} className="t-icon-swap">'));
});

test('C040: 启动台浮层与抽屉分段接入入场动效', () => {
  assert.ok(/className="origin-menu t-pop-in /.test(launchpadSrc), '右键菜单须自点击源点弹入');
  assert.ok(launchpadSrc.includes("'--pop-origin': 'top left'"));
  assert.ok(/key=\{expandedFolder\.id\}\s*className="t-pop-in /.test(launchpadSrc), '文件夹托盘切换文件夹须重放弹入');
  assert.equal((launchpadSrc.match(/className="t-dialog-in /g) || []).length, 2, '添加/编辑与重命名对话框卡片须入场');
  assert.ok(/backdrop-blur-md t-toast select-none">\s*<span>已移除/.test(launchpadSrc), '撤销通知须使用 t-toast 升起');
  assert.equal((drawerSrc.match(/className="t-tab-in /g) || []).length, 2);
  assert.equal((feedSrc.match(/className="t-tab-in /g) || []).length, 2);
});

// ── 5. 搜索框选中态：只用边框高亮，不使用液态玻璃 ─────────────────

test('C040: 搜索框不使用液态玻璃高光，选中态仅以边框高亮提示', () => {
  const form = searchBarSrc.match(/className="home-layer search-field[^"]*"/);
  assert.ok(form, '搜索框须使用 search-field');
  assert.ok(!/liquid-glass/.test(form[0]), '搜索框不得再挂任何 liquid-glass 类');
  assert.ok(!/focus-within:shadow|hover:shadow/.test(form[0]), '选中/悬停不得改变投影');
  assert.ok(searchBarSrc.includes('data-tone={tone}'));
  assert.ok(searchBarSrc.includes('backdropFilter: `blur(${blurPx}px)`'), '搜索框背景只按用户模糊值处理，不叠加 saturate');
  assert.ok(!motionCss.includes('liquid-glass-field'), '液态玻璃体规则须整体移除');
  assert.ok(!motionCss.includes('form.liquid-glass-surface:focus-within'), '旧的顶边高光选中态不得恢复');

  const rules = [...motionCss.matchAll(/\n(\.search-field[^{\n]*)\{([^}]*)\}/g)];
  assert.equal(rules.length, 6, '静止/悬停/选中 × 深浅两种环境');
  for (const [, selector, body] of rules) {
    const declarations = body.split(';').map((d) => d.trim()).filter(Boolean);
    assert.equal(declarations.length, 1, `${selector.trim()} 只允许声明边框色`);
    assert.ok(declarations[0].startsWith('border-color:'), `${selector.trim()} 只允许声明边框色`);
  }
  const alpha = (selector) => Number(ruleBody(motionCss, selector).match(/, ([\d.]+)\)/)[1]);
  assert.ok(alpha('.search-field:focus-within') > alpha('.search-field:hover'));
  assert.ok(alpha('.search-field:hover') > alpha('.search-field'));
  assert.ok(alpha(".search-field[data-tone='light']:focus-within") > alpha(".search-field[data-tone='light']:hover"));
  assert.ok(alpha(".search-field[data-tone='light']:hover") > alpha(".search-field[data-tone='light']"));
});
