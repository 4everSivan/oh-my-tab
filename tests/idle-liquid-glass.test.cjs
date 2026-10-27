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

test('T19: motion.css 包含液态玻璃方案B空间错峰动效令牌与 reduced-motion 守卫', () => {
  const motionCss = fs.readFileSync(path.join(ROOT, 'src/styles/motion.css'), 'utf-8');
  assert.ok(motionCss.includes('--idle-fade-dur: 1600ms;'), '必须定义方案B 1600ms --idle-fade-dur 令牌');
  assert.ok(motionCss.includes('--idle-wake-dur: 200ms;'), '必须定义 --idle-wake-dur 令牌');
  assert.ok(motionCss.includes('--idle-topbar-delay: 0ms;'), '必须定义 --idle-topbar-delay 错峰延时');
  assert.ok(motionCss.includes('--idle-shortcuts-delay: 180ms;'), '必须定义 --idle-shortcuts-delay 错峰延时');
  assert.ok(motionCss.includes('--idle-search-delay: 320ms;'), '必须定义 --idle-search-delay 错峰延时');
  assert.ok(motionCss.includes('--idle-clock-delay: 450ms;'), '必须定义 --idle-clock-delay 错峰延时');
  assert.ok(motionCss.includes('.liquid-glass-surface'), '必须定义 .liquid-glass-surface 物理液化类名');
  assert.ok(motionCss.includes('.t-idle-topbar'), '必须定义 .t-idle-topbar 错峰层');
  assert.ok(motionCss.includes('.t-idle-shortcuts'), '必须定义 .t-idle-shortcuts 错峰层');
  assert.ok(motionCss.includes('.t-idle-search'), '必须定义 .t-idle-search 错峰层');
  assert.ok(motionCss.includes('.t-idle-clock'), '必须定义 .t-idle-clock 错峰层');
  assert.ok(motionCss.includes('[data-idle="true"] .t-idle-clock:hover'), '必须包含局部聚光唤醒 hover 规则');

  // 验证 reduced-motion 全局降级守卫
  const reducedMotionBlock = motionCss.slice(motionCss.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(reducedMotionBlock.includes('.t-idle-topbar'), 'reduced-motion 守卫必须包含 .t-idle-topbar');
  assert.ok(reducedMotionBlock.includes('.t-idle-shortcuts'), 'reduced-motion 守卫必须包含 .t-idle-shortcuts');
  assert.ok(reducedMotionBlock.includes('.t-idle-search'), 'reduced-motion 守卫必须包含 .t-idle-search');
  assert.ok(reducedMotionBlock.includes('.t-idle-clock'), 'reduced-motion 守卫必须包含 .t-idle-clock');
  assert.ok(reducedMotionBlock.includes('.liquid-glass-surface'), 'reduced-motion 守卫必须包含 .liquid-glass-surface');
});

test('T19: useIdleDetection Hook 具备严谨的防抖重置、全域监听与避让守卫', () => {
  const hookTs = fs.readFileSync(path.join(ROOT, 'src/hooks/useIdleDetection.ts'), 'utf-8');
  assert.ok(hookTs.includes('export function useIdleDetection'), '必须导出 useIdleDetection 函数');
  assert.ok(hookTs.includes('isGuarded'), '必须支持 isGuarded 避让状态');
  assert.ok(hookTs.includes('mousemove') && hookTs.includes('keydown') && hookTs.includes('scroll'), '必须监听全域核心活动事件');
  assert.ok(hookTs.includes('resetTimer'), '必须导出 resetTimer');
  assert.ok(hookTs.includes('forceIdle'), '必须导出 forceIdle');
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
  assert.ok(appTs.includes('t-idle-topbar liquid-glass-surface'), '顶栏配置按钮必须接入 t-idle-topbar liquid-glass-surface');
  assert.ok(appTs.includes('ref={clockContainerRef} className="w-full t-idle-clock"'), '时钟容器必须挂载 t-idle-clock');
  assert.ok(appTs.includes('ref={searchContainerRef} className="w-full t-idle-search"'), '搜索框容器必须挂载 t-idle-search');
  assert.ok(appTs.includes('className="w-full mt-6 t-idle-shortcuts"'), '常用网站容器必须挂载 t-idle-shortcuts');
  assert.ok(appTs.includes('footer className="w-full py-4 text-center select-none text-[11px] opacity-40 hover:opacity-70 transition-opacity t-idle-topbar"'), '页脚必须挂载 t-idle-topbar');
});

test('T19: AppearanceDrawer 提供闲置淡化配置开关与时长分段调节', () => {
  const drawerTs = fs.readFileSync(path.join(ROOT, 'src/components/settings/AppearanceDrawer.tsx'), 'utf-8');
  assert.ok(drawerTs.includes('闲置呼吸淡化'), '必须包含「闲置呼吸淡化」标题');
  assert.ok(drawerTs.includes('开启无操作闲置呼吸淡化'), '必须提供启用开关');
  assert.ok(drawerTs.includes('闲置触发时间'), '必须提供触发时间选择');
  assert.ok(drawerTs.includes('onUpdateIdle'), '必须接入 onUpdateIdle 回调');
});
