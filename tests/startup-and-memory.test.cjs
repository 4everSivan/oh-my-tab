const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('C015: storage 服务导出 bootCache 接口且具备防御性容错能力', () => {
  const storageSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/storage/index.ts'), 'utf-8');

  assert.ok(storageSrc.includes('BOOT_CACHE_KEY = \'oh_my_tab_boot_cache\''), '必须定义专用的 bootCache 键名');
  assert.ok(storageSrc.includes('export function getBootCache()'), '必须导出 getBootCache 函数');
  assert.ok(storageSrc.includes('export function updateBootCache('), '必须导出 updateBootCache 函数');
  assert.ok(storageSrc.includes('async loadAllSettings()'), '必须导出并发加载函数 loadAllSettings');

  // 验证对 localStorage 不可用或 JSON 损坏的防御
  assert.ok(storageSrc.includes('try {'), '读写 bootCache 必须有 try-catch 防御');
  assert.ok(storageSrc.includes('localStorage.getItem'), '读取必须经由 localStorage');
  assert.ok(storageSrc.includes('localStorage.setItem'), '更新必须同步写回 localStorage');
});

test('C015: loadAllSettings 采用 Promise.all 并发读取，消除串行 IPC 延迟', () => {
  const storageSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/storage/index.ts'), 'utf-8');

  // 必须使用 Promise.all 并发
  const match = storageSrc.match(/async loadAllSettings\(\)[^{]*\{[\s\S]*?Promise\.all\(\[([\s\S]*?)\]\)/);
  assert.ok(match, 'loadAllSettings 必须使用 Promise.all 并行加载 6 大核心配置');
  
  const promisesContent = match[1];
  assert.ok(promisesContent.includes('this.getClock()'), '必须并发读取 clock');
  assert.ok(promisesContent.includes('this.getSearch()'), '必须并发读取 search');
  assert.ok(promisesContent.includes('this.getEngine()'), '必须并发读取 engine');
  assert.ok(promisesContent.includes('this.getBackground()'), '必须并发读取 background');
  assert.ok(promisesContent.includes('this.getShortcuts()'), '必须并发读取 shortcuts');
  assert.ok(promisesContent.includes('this.getLayout()'), '必须并发读取 layout');
});

test('C015: useAdaptiveContrast 统合为单画布采样管线，并在采样后释放 GPU 内存与节流 resize', () => {
  const hookPath = path.resolve(__dirname, '../src/hooks/useAdaptiveContrast.ts');
  assert.ok(fs.existsSync(hookPath), 'src/hooks/useAdaptiveContrast.ts 必须存在');

  const hookSrc = fs.readFileSync(hookPath, 'utf-8');

  // 统一离线 Canvas
  assert.ok(hookSrc.includes('document.createElement(\'canvas\')'), '必须创建离线 Canvas 采样');
  // GPU 显存释放契约：width = 0, height = 0
  assert.ok(hookSrc.includes('canvas.width = 0'), '采样完毕后必须重置 canvas.width = 0 释放 Backing Store');
  assert.ok(hookSrc.includes('canvas.height = 0'), '采样完毕后必须重置 canvas.height = 0 释放 Backing Store');
  // requestAnimationFrame 节流契约
  assert.ok(hookSrc.includes('requestAnimationFrame'), '窗口 resize 监听必须通过 requestAnimationFrame 防抖节流');
  // 必须导出即时计算函数，防首帧空白
  assert.ok(hookSrc.includes('export function computeInitialAdaptiveContrast'), '必须导出 computeInitialAdaptiveContrast');
});

test('C015: App.tsx 首帧使用惰性初始化直出用户配置，且管理 Blob URL 生命周期防止内存泄漏', () => {
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf-8');

  // 惰性状态初始化
  assert.ok(appSrc.includes('const boot = getBootCache()'), 'App 必须同步获取启动快照');
  assert.ok(appSrc.includes('useState<ClockAppearance>(() => boot?.clock ?? DEFAULT_CLOCK_APPEARANCE)'), 'clock state 必须使用惰性初始化');
  assert.ok(appSrc.includes('useState<SearchAppearance>(() => boot?.search ?? DEFAULT_SEARCH_APPEARANCE)'), 'search state 必须使用惰性初始化');
  assert.ok(appSrc.includes('useState<BackgroundConfig>(() => boot?.background ?? DEFAULT_BACKGROUND_CONFIG)'), 'background state 必须使用惰性初始化');

  // 并发加载
  assert.ok(appSrc.includes('storageService.loadAllSettings()'), 'App 必须调用并发批处理 loadAllSettings');

  // Blob URL 释放生命周期
  assert.ok(appSrc.includes('currentBlobUrlRef'), '必须通过 ref 追踪当前激活的 Blob URL');
  assert.ok(appSrc.includes('URL.revokeObjectURL(currentBlobUrlRef.current)'), '壁纸更换或重置时必须主动销毁旧的 Blob URL');
  assert.ok(appSrc.includes('return () => {'), 'App useEffect 必须声明 cleanup 函数');
  assert.ok(appSrc.includes('URL.revokeObjectURL'), 'App 卸载时必须执行 URL.revokeObjectURL 杜绝常驻内存泄漏');

  // 背景层柔和过渡
  assert.ok(appSrc.includes('transition-all duration-300'), '背景层必须声明 transition 平滑过渡');
});
