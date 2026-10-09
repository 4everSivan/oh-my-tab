const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// C001 壁纸恢复回归（@topic: DataPersistenceSync，卡片 docs/devel/change/C001.json）
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const appSrc = read('src/App.tsx');
const drawerSrc = read('src/components/settings/AppearanceDrawer.tsx');
const wallpaperSrc = read('src/services/storage/wallpaper.ts');
const bgUtilsSrc = read('src/utils/background.ts');

// ── 1. 恢复裁决纯函数：三分支决策表 ─────────────────────────────
test('planBackgroundRestore 决策表：as-is / restore / fallback 三分支', () => {
  // 与 src/utils/background.ts 保持一致的语义期望（防公式漂移）
  const plan = (config, hasRecord) => {
    if (config.type !== 'image' || !config.imageId) return { kind: 'as-is' };
    if (hasRecord) return { kind: 'restore' };
    return { kind: 'fallback' };
  };
  const imageBg = { type: 'image', imageId: 'wp-1', color: '#fff', name: 'a.png', shade: 0, blur: 0, position: 'center' };

  assert.equal(plan({ ...imageBg, type: 'material' }, true).kind, 'as-is');   // 非图片背景
  assert.equal(plan({ ...imageBg, imageId: '' }, true).kind, 'as-is');       // 图片背景但无 id
  assert.equal(plan(imageBg, true).kind, 'restore');                          // 图片 + 记录存在
  assert.equal(plan(imageBg, false).kind, 'fallback');                        // 图片 + 记录缺失
  // 源码必须实现同样的三分支与 fallback 字段清理
  assert.ok(bgUtilsSrc.includes("kind: 'as-is'"), '缺 as-is 分支');
  assert.ok(bgUtilsSrc.includes("kind: 'restore'"), '缺 restore 分支');
  assert.ok(bgUtilsSrc.includes("kind: 'fallback'"), '缺 fallback 分支');
  assert.ok(/fallback[\s\S]{0,400}imageBlobUrl: undefined/.test(bgUtilsSrc), 'fallback 未清除死链 imageBlobUrl');
  assert.ok(/fallback[\s\S]{0,400}imageId: ''/.test(bgUtilsSrc), 'fallback 未清除 imageId');
});

// ── 2. App 加载链路接线 ─────────────────────────────────────────
test('App 启动时从 IndexedDB 恢复壁纸 Blob，记录缺失回退材质并回写存储', () => {
  assert.ok(appSrc.includes('planBackgroundRestore'), 'App 未接入恢复裁决');
  assert.ok(appSrc.includes('storageService.wallpaper.getWallpaper'), 'App 未按 imageId 取回记录');
  assert.ok(appSrc.includes('URL.createObjectURL'), 'App 未重建会话级 objectURL');
  assert.ok(/plan\.kind === 'fallback'[\s\S]{0,200}storageService\.setBackground/.test(appSrc), 'fallback 未回写存储，死链配置会反复进入启动路径');
});

// ── 3. 上传链路异常反馈 ─────────────────────────────────────────
test('上传失败有可见反馈且不再静默中断，成功时回收旧派生地址', () => {
  assert.ok(/try\s*\{[\s\S]*saveWallpaper[\s\S]*\}\s*catch/.test(drawerSrc), '上传链路缺少 try/catch');
  assert.ok(drawerSrc.includes('setUploadError'), '缺少错误状态');
  assert.ok(/uploadError &&/.test(drawerSrc), '错误文案未渲染到界面');
  assert.ok(drawerSrc.includes('role="alert"'), '错误提示应为 alert 语义');
  assert.ok(drawerSrc.includes('revokeObjectURL'), '未回收旧 objectURL（Blob 泄漏）');
});

// ── 4. IndexedDB 空库自愈 ───────────────────────────────────────
test('WallpaperStorage 空库自愈：缺表时删除重建触发建表升级', () => {
  assert.ok(wallpaperSrc.includes('objectStoreNames.contains(STORE_NAME)'), '未校验 wallpapers 表存在性');
  assert.ok(/deleteDatabase[\s\S]{0,300}openDatabase\(\)/.test(wallpaperSrc), '缺表时未删除重建');
  assert.ok(wallpaperSrc.includes('onblocked'), '删除库未处理 blocked 事件（挂起风险）');
  assert.ok(/catch[\s\S]{0,160}dbPromise = null/.test(wallpaperSrc), '打开失败未重置缓存，后续无法重试');
});

// ── 5. 既有行为不回归 ───────────────────────────────────────────
test('壁纸走 IndexedDB 的分层边界未被破坏（MOT/T02 既有契约）', () => {
  assert.ok(wallpaperSrc.includes("indexedDB.open(DB_NAME, DB_VERSION)"), '仍应以固定版本打开');
  assert.ok(read('tests/motion-system.test.cjs').length > 0, '动效套件应在位');
  // Blob 与轻量配置分层：settings.background 仍走 chrome/localStorage 适配器
  assert.ok(read('src/services/storage/index.ts').includes("'settings.background'"), '背景配置键不应迁移到 IndexedDB');
});

// ── 6. C002 拖拽上传通道 ───────────────────────────────────────
test('拖拽上传接线完整：dragover 阻止默认、drop 取文件、与选择器共用保存链路', () => {
  assert.ok(drawerSrc.includes('onDrop={handleWallpaperDrop}'), '上传区未接 onDrop');
  assert.ok(/onDragOver=\{[^}]*preventDefault/.test(drawerSrc), 'onDragOver 未 preventDefault（drop 不会被允许）');
  assert.ok(drawerSrc.includes('onDragLeave'), '缺少 dragleave 取消高亮');
  assert.ok(drawerSrc.includes('e.dataTransfer.files'), 'drop 未从 dataTransfer 取文件');
  const sharedCalls = drawerSrc.match(/await applyWallpaperFile\(file\)/g) || [];
  assert.equal(sharedCalls.length, 2, '选择器与拖拽两条通道都必须走 applyWallpaperFile 唯一链路');
});

test('拖拽通道有图片类型校验，非图片文件给出可见提示', () => {
  assert.ok(/applyWallpaperFile[\s\S]{0,260}startsWith\('image\/'\)/.test(drawerSrc), '共用链路缺少 image/* 类型校验');
  assert.ok(drawerSrc.includes('仅支持图片文件'), '非图片文件缺少可见错误提示');
});
