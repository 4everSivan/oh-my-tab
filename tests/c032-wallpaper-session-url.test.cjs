const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createMemoryLocalStorage } = require('./helpers/load-ts.cjs');

// ── C032 会话级壁纸 Blob URL 不得落盘：首帧回到 previewUrl 缩略图直出 ──────────────

globalThis.localStorage = createMemoryLocalStorage();
const {
  StorageService,
  BOOT_CACHE_KEY,
  getBootCache,
  toPersistedBackground,
} = require('../src/services/storage/index.ts');

const appSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');

function createService() {
  const store = new Map();
  let emit = () => {};
  const adapter = {
    async get(k, fb) {
      return store.has(k) ? store.get(k) : fb;
    },
    async set(k, v) {
      store.set(k, v);
    },
    async remove(k) {
      store.delete(k);
    },
    async clear() {
      store.clear();
    },
    onChanged(cb) {
      emit = cb;
      return () => {};
    },
  };
  return { service: new StorageService(adapter, {}), store, emitChange: (changes) => emit(changes) };
}

const uploaded = {
  type: 'image',
  imageId: 'wallpaper-1',
  imageBlobUrl: 'blob:chrome-extension://abc/session-1',
  previewUrl: 'data:image/jpeg;base64,THUMB',
};

test.beforeEach(() => localStorage.clear());

test('C032: setBackground 落盘与启动快照剥离 imageBlobUrl，返回值保留供本页渲染', async () => {
  const { service, store } = createService();
  const updated = await service.setBackground(uploaded);

  assert.equal(updated.imageBlobUrl, uploaded.imageBlobUrl, '返回值需保留会话 Blob URL 供当前页渲染');
  const persisted = store.get('settings.background');
  assert.equal('imageBlobUrl' in persisted, false, '存储中不得出现 imageBlobUrl');
  assert.equal(persisted.imageId, 'wallpaper-1');
  assert.equal(persisted.previewUrl, uploaded.previewUrl);

  const boot = JSON.parse(localStorage.getItem(BOOT_CACHE_KEY));
  assert.equal('imageBlobUrl' in boot.background, false, '启动快照中不得出现 imageBlobUrl');
});

test('C032: 旧版本已写入的死链在读取时剥离（存储、启动快照、跨标签事件）', async () => {
  const { service, store, emitChange } = createService();
  store.set('settings.background', { ...uploaded });
  localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify({ background: { ...uploaded } }));

  const loaded = await service.getBackground();
  assert.equal(loaded.imageBlobUrl, undefined);
  assert.equal(loaded.previewUrl, uploaded.previewUrl, '缩略图必须保留以供首帧直出');
  assert.equal(getBootCache().background.imageBlobUrl, undefined);

  const received = [];
  service.onSettingsChanged((key, value) => received.push([key, value]));
  emitChange({ 'settings.background': { newValue: { ...uploaded } } });
  assert.equal(received.length, 1);
  assert.equal(received[0][0], 'settings.background');
  assert.equal(received[0][1].imageBlobUrl, undefined, '跨标签事件不得传播其他页面的 Blob URL');
  assert.equal(getBootCache().background.imageBlobUrl, undefined);
});

test('C032: toPersistedBackground 对无 Blob 字段的配置原样返回', () => {
  const color = { type: 'color', color: '#fff', imageId: '' };
  assert.equal(toPersistedBackground(color), color);
});

test('C032: App 跨标签同步按 imageId 重建本页 Blob URL，不再合并他页派生地址', () => {
  assert.ok(appSrc.includes('applyExternalBackground(newValue as BackgroundConfig)'));
  assert.ok(!appSrc.includes('setBackground((prev) => ({ ...prev, ...(newValue'), '不得再把外部背景直接合并进当前状态');
  assert.ok(appSrc.includes('currentBlobImageIdRef.current !== next.imageId'), '仅当 imageId 变化时才重建派生地址');
});
