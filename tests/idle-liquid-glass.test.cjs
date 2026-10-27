const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('T19: DEFAULT_IDLE_APPEARANCE 与 types 契约定义完整', () => {
  const typesTs = fs.readFileSync(path.join(ROOT, 'src/services/storage/types.ts'), 'utf-8');
  assert.ok(typesTs.includes('export interface IdleAppearance'), '必须导出 IdleAppearance 接口');
  assert.ok(typesTs.includes('enabled: boolean'), 'IdleAppearance 必须包含 enabled');
  assert.ok(typesTs.includes('timeoutSeconds: number'), 'IdleAppearance 必须包含 timeoutSeconds');
  assert.ok(typesTs.includes('DEFAULT_IDLE_APPEARANCE: IdleAppearance'), '必须导出 DEFAULT_IDLE_APPEARANCE 默认值');
  assert.ok(typesTs.includes('idle?: IdleAppearance;'), 'AppSettings 必须包含 idle 配置项');
});

test('T19: StorageService 具备完整的 idle 配置读写与启动快照契约', () => {
  const storageTs = fs.readFileSync(path.join(ROOT, 'src/services/storage/index.ts'), 'utf-8');
  assert.ok(storageTs.includes("IDLE: 'settings.idle'"), 'STORAGE_KEYS 必须包含 IDLE');
  assert.ok(storageTs.includes('idle?: IdleAppearance;'), 'BootCache 必须支持 idle');
  assert.ok(storageTs.includes('async getIdle(): Promise<IdleAppearance>'), '必须包含 getIdle 方法');
  assert.ok(storageTs.includes('async setIdle('), '必须包含 setIdle 方法');
  assert.ok(storageTs.includes('async resetIdle(): Promise<IdleAppearance>'), '必须包含 resetIdle 方法');
  assert.ok(storageTs.includes('this.getIdle()'), 'loadAllSettings 必须并发读取 idle 配置');
});

test('T19: motion.css 包含液态玻璃动效令牌与闲置聚焦淡化规则', () => {
  const motionCss = fs.readFileSync(path.join(ROOT, 'src/styles/motion.css'), 'utf-8');
  assert.ok(motionCss.includes('--idle-fade-dur: 1000ms;'), '必须定义 1000ms --idle-fade-dur 淡出时长');
  assert.ok(motionCss.includes('--idle-wake-dur: 200ms;'), '必须定义 200ms --idle-wake-dur 极速唤醒时长');
  assert.ok(motionCss.includes('--idle-opacity: 0.38;'), '必须定义 --idle-opacity 0.38 作为搜索框保留的透明度');
  assert.ok(motionCss.includes('--ease-idle-fade'), '必须定义平滑过渡缓动曲线 --ease-idle-fade');
  assert.ok(motionCss.includes('.liquid-glass-surface'), '必须定义 .liquid-glass-surface 液态玻璃类名');
  assert.ok(
    /\[data-idle="true"\] \.t-idle-target,[\s\S]{0,400}?opacity: 0;/.test(motionCss),
    '闲置态必须把时钟/顶栏/图标栏等目标整体隐去（opacity: 0）'
  );
  assert.ok(
    /\[data-idle="true"\] \.t-idle-target,[\s\S]{0,400}?pointer-events: none;/.test(motionCss),
    '隐去后必须让出指针事件，杜绝不可见点击目标'
  );
  // 搜索框是闲置态唯一保留的元素：进入隐去规则则违背"只显示搜索框"，
  // 同时它必须单独淡化到 --idle-opacity，而不是保持常亮
  const hideStart = motionCss.indexOf('[data-idle="true"] .t-idle-target,');
  const idleHideBlock = motionCss.slice(hideStart, motionCss.indexOf('}', hideStart) + 1);
  assert.ok(!idleHideBlock.includes('.t-idle-search'), '搜索框不得被闲置态隐去（opacity: 0）');
  assert.ok(
    /\[data-idle="true"\] \.t-idle-search\s*\{[\s\S]{0,300}?opacity: var\(--idle-opacity\);/.test(motionCss),
    '搜索框闲置态必须淡化到 --idle-opacity'
  );
  assert.ok(
    /\[data-idle="true"\] \.t-idle-search:hover\s*\{[\s\S]{0,200}?opacity: 1;/.test(motionCss),
    '闲置态指针扫过必须只把搜索框点亮回 1（移动鼠标不唤回其他区块）'
  );
  assert.ok(
    !/\[data-idle="true"\] \.t-idle-target:hover/.test(motionCss),
    '目标隐去后不应保留 hover 聚光回显（否则会破坏"只显示搜索框"）'
  );

  // 验证 reduced-motion 全局降级守卫
  const reducedMotionBlock = motionCss.slice(motionCss.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(reducedMotionBlock.includes('.t-idle-target'), 'reduced-motion 守卫必须包含 .t-idle-target');
  assert.ok(reducedMotionBlock.includes('.liquid-glass-surface'), 'reduced-motion 守卫必须包含 .liquid-glass-surface');
  assert.ok(
    /\[data-idle="true"\] \.t-idle-target,[\s\S]{0,400}?transition-duration: var\(--idle-fade-dur\) !important;/.test(
      reducedMotionBlock
    ),
    'reduced-motion 下闲置目标必须保留 fade 时长的透明度过渡（否则淡出变成瞬跳、整条动效不可见）'
  );
  assert.ok(
    /\[data-idle="true"\] \.t-idle-target,[\s\S]{0,400}?transition-duration: 0\.01ms !important;/.test(motionCss) === false,
    '闲置目标不得残留在归零名单中'
  );
});

test('T19: useIdleDetection Hook 具备严谨的防抖重置、唤醒事件集与避让守卫', () => {
  const hookTs = fs.readFileSync(path.join(ROOT, 'src/hooks/useIdleDetection.ts'), 'utf-8');
  assert.ok(hookTs.includes('export function useIdleDetection'), '必须导出 useIdleDetection 函数');
  assert.ok(hookTs.includes('isGuarded'), '必须支持 isGuarded 避让状态');

  // C038：闲置前的活动事件扩到指针，否则用户只动鼠标不点键盘也会被判"无操作"
  const eventsMatch = hookTs.match(/const events = (\[[^\]]*\]);/);
  assert.ok(eventsMatch, '必须声明活动事件集');
  const eventNames = JSON.parse(eventsMatch[1].replace(/'/g, '"'));
  assert.deepEqual(
    [...eventNames].sort(),
    ['keydown', 'pointerdown', 'pointermove', 'wheel'],
    '未闲置时键盘、指针移动/按下与滚轮都必须计入活动事件'
  );
  assert.ok(
    !/const events = \[[^\]]*'scroll'/.test(hookTs),
    'scroll 不得作为活动事件：滚动条与程序化滚动都会触发，改由 pointerdown/pointermove 承载'
  );
  assert.ok(
    hookTs.includes('POINTER_ACTIVITY_DISTANCE_PX'),
    '指针移动必须按累计位移阈值过滤静止抖动，避免指针微动让页面永不闲置'
  );
  assert.ok(
    /if \(isIdleRef\.current\)[\s\S]{0,600}?key !== '`'[\s\S]{0,80}?key !== 'Escape'\) return;[\s\S]{0,40}?resetTimer\(\);/,
    '进入闲置后指针事件必须提前返回，只有 ` 与 Escape 重置倒计时（显式唤醒入口制）'
  );
  assert.ok(hookTs.includes('resetTimer'), '必须导出 resetTimer');
  assert.ok(hookTs.includes('forceIdle'), '必须导出 forceIdle');

  // 快捷键层在闲置态必须整体挂起，避免在隐去的界面上开抽屉/弹窗
  const kbdTs = fs.readFileSync(path.join(ROOT, 'src/hooks/useKeyboardShortcuts.ts'), 'utf-8');
  assert.ok(kbdTs.includes('suspended?: boolean'), 'useKeyboardShortcuts 必须支持 suspended 挂起开关');
  assert.ok(
    /if \(suspended && e\.key !== '`' && e\.key !== '~' && e\.key !== 'Escape'\) return;/.test(kbdTs),
    '闲置态只放行 ` 与 Escape，其余单键快捷键必须提前返回'
  );
});

test('T19: SearchBar 支持输入聚焦 onFocusChange 事件透传', () => {
  const searchBarTs = fs.readFileSync(path.join(ROOT, 'src/components/search/SearchBar.tsx'), 'utf-8');
  assert.ok(searchBarTs.includes('onFocusChange?: (focused: boolean) => void;'), 'SearchBarProps 必须包含 onFocusChange');
  assert.ok(searchBarTs.includes('onFocusChange?.(true);'), 'onFocus 必须通知聚焦');
  assert.ok(searchBarTs.includes('onFocusChange?.(false);'), 'onBlur 必须通知失焦');
  assert.ok(searchBarTs.includes('liquid-glass-surface'), 'SearchBar 容器表层必须接入 liquid-glass-surface');
});

test('T19: Shortcuts 图标容器接入 shortcut-icon-container 与 liquid-glass-surface', () => {
  const shortcutsTs = fs.readFileSync(path.join(ROOT, 'src/components/shortcuts/Shortcuts.tsx'), 'utf-8');
  assert.ok(shortcutsTs.includes('shortcut-icon-container liquid-glass-surface'), '快捷网站与文件夹图标容器必须接入液态玻璃与半透明类');
});

test('T19: App.tsx 核心区块全量接线与输入/抽屉避让守卫', () => {
  const appTs = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf-8');
  assert.ok(appTs.includes('data-idle={isIdle ? \'true\' : \'false\'}'), '根元素必须挂载 data-idle 状态标识');
  assert.ok(appTs.includes('useIdleDetection'), 'App.tsx 必须挂载 useIdleDetection');
  assert.ok(appTs.includes('isGuarded'), 'App.tsx 必须根据抽屉和搜索焦点计算 isGuarded');
  assert.ok(appTs.includes('onFocusChange={setIsSearchFocused}'), 'SearchBar 必须接线 onFocusChange');
  assert.ok(appTs.includes('t-idle-target liquid-glass-surface'), '顶栏配置按钮必须接入 t-idle-target liquid-glass-surface');
  assert.ok(appTs.includes('ref={clockContainerRef} className="w-full t-idle-target"'), '时钟容器必须挂载 t-idle-target');
  assert.ok(appTs.includes('ref={searchContainerRef}'), '搜索框容器必须保留 ref');
  assert.ok(appTs.includes('className="w-full t-idle-search"'), '搜索框容器必须挂载 t-idle-search（闲置态唯一保留，只淡化不隐去）');
  assert.ok(appTs.includes('onPointerDown={handleSearchPointerDown}'), '搜索框必须提供点击唤醒入口');
  assert.ok(appTs.includes('suspended: isIdle'), '闲置态必须挂起全局单键快捷键');
  assert.ok(
    /handleSearchPointerDown[\s\S]{0,300}?wakeFromIdle\(\)[\s\S]{0,300}?searchInputRef\.current\?\.focus\(\)/.test(appTs),
    '点击搜索框必须唤醒整页并进入输入态'
  );
  assert.ok(appTs.includes('className="w-full mt-6 t-idle-target"'), '常用网站容器必须挂载 t-idle-target');
  assert.ok(appTs.includes('className="w-full mt-4 t-idle-target"'), '组件区容器必须挂载 t-idle-target');
  assert.ok(appTs.includes('footer className="w-full py-4 text-center select-none text-[11px] opacity-40 hover:opacity-70 transition-opacity t-idle-target"'), '页脚必须挂载 t-idle-target');
});

test('T19: AppearanceDrawer 提供闲置淡化配置开关与时长分段调节', () => {
  const drawerTs = fs.readFileSync(path.join(ROOT, 'src/components/settings/AppearanceDrawer.tsx'), 'utf-8');
  assert.ok(drawerTs.includes('闲置聚焦淡化'), '必须包含「闲置聚焦淡化」标题');
  assert.ok(drawerTs.includes('开启无操作闲置聚焦淡化'), '必须提供启用开关');
  assert.ok(drawerTs.includes('闲置触发时间'), '必须提供触发时间选择');
  assert.ok(drawerTs.includes('onUpdateIdle'), '必须接入 onUpdateIdle 回调');
});
