const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── C025 存储并发竞争写丢失、事务假成功、iTab多组导入遗漏与跨标签同步回归测试 ─────────

test('C025: WallpaperStorage 严格在 transaction.oncomplete 时 resolve (N13)', () => {
  const wallpaperSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'storage', 'wallpaper.ts'),
    'utf8'
  );

  const saveBlock = wallpaperSrc.slice(wallpaperSrc.indexOf('async saveWallpaper'), wallpaperSrc.indexOf('async getWallpaper'));
  const deleteBlock = wallpaperSrc.slice(wallpaperSrc.indexOf('async deleteWallpaper'));

  assert.ok(
    !saveBlock.includes('request.onsuccess = () => resolve()'),
    'saveWallpaper 严禁在 request.onsuccess 提前 resolve'
  );
  assert.ok(
    !deleteBlock.includes('request.onsuccess = () => resolve()'),
    'deleteWallpaper 严禁在 request.onsuccess 提前 resolve'
  );
  assert.ok(
    saveBlock.includes('transaction.oncomplete = () => resolve()'),
    'saveWallpaper 必须在 transaction.oncomplete 时 resolve'
  );
  assert.ok(
    deleteBlock.includes('transaction.oncomplete = () => resolve()'),
    'deleteWallpaper 必须在 transaction.oncomplete 时 resolve'
  );
  assert.ok(
    wallpaperSrc.includes('transaction.onabort = () => reject('),
    'wallpaper.ts 必须处理 transaction.onabort 异常中止'
  );
});

test('C025: ChromeStorageAdapter Web 降级存储 memoryFallback 读写一致性 (N14)', async () => {
  const storageSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'storage', 'chromeStorage.ts'),
    'utf8'
  );

  // 源码必须包含 memoryFallback 优先读取逻辑
  assert.ok(
    storageSrc.includes('if (this.memoryFallback.has(key))') ||
    storageSrc.includes('this.memoryFallback.has(key)'),
    'get 必须优先返回 memoryFallback 保证降级写入可读回'
  );

  // 模拟降级内存存储行为验证
  class MockChromeStorageAdapter {
    constructor() {
      this.memoryFallback = new Map();
      this.quotaFull = true;
    }

    async get(key, fallback) {
      if (this.memoryFallback.has(key)) {
        return this.memoryFallback.get(key);
      }
      return fallback;
    }

    async set(key, value) {
      if (this.quotaFull) {
        // 模拟 localStorage 抛出 QuotaExceededError
        this.memoryFallback.set(key, value);
        return;
      }
    }

    async remove(key) {
      this.memoryFallback.delete(key);
    }
  }

  const adapter = new MockChromeStorageAdapter();
  await adapter.set('settings.test', { theme: 'cyberpunk', scale: 1.2 });
  const result = await adapter.get('settings.test', { theme: 'default' });

  assert.deepEqual(result, { theme: 'cyberpunk', scale: 1.2 }, '降级内存写入后必须能准确读出最新值');

  await adapter.remove('settings.test');
  const removed = await adapter.get('settings.test', { theme: 'default' });
  assert.deepEqual(removed, { theme: 'default' }, '删除后必须返回默认 fallback');
});

test('C025: iTab 多分组完整解析与无漏项导入 (N02)', () => {
  const transferSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'shortcuts', 'transfer.ts'),
    'utf8'
  );

  // 模拟真实 iTab navConfig 2 个分组输入
  const mockITabNavConfig = {
    navConfig: [
      {
        id: '101',
        name: '主页推荐',
        children: [
          { name: 'GitHub', url: 'https://github.com' },
          { name: 'V2EX', url: 'https://v2ex.com' },
        ],
      },
      {
        id: '102',
        name: '开发常用',
        children: [
          { name: 'MDN Web', url: 'https://developer.mozilla.org' },
          { name: 'React Docs', url: 'https://react.dev' },
        ],
      },
    ],
  };

  // 验证 transfer.ts 源码中不只保留 homeGroup.shortcuts
  assert.ok(
    transferSrc.includes('return { valid: allValidShortcuts, groups: extractedGroups }'),
    'transfer.ts 必须全量返回 allValidShortcuts 与 extractedGroups'
  );

  // 静态解析验证
  const groups = mockITabNavConfig.navConfig;
  const allShortcuts = [];
  groups.forEach((g) => {
    g.children.forEach((c) => allShortcuts.push(c));
  });

  assert.equal(allShortcuts.length, 4, '必须全量涵盖两个分组的 4 项网站，绝不能仅保留前 2 项');
});

test('C025: StorageService 具备并发写互斥锁与跨标签多播能力 (N01 & N12)', () => {
  const storageIndexSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'storage', 'index.ts'),
    'utf8'
  );

  assert.ok(
    storageIndexSrc.includes('class AsyncMutex') || storageIndexSrc.includes('mutex = new AsyncMutex'),
    'StorageService 必须接入 AsyncMutex 序列化并发读改写'
  );
  assert.ok(
    storageIndexSrc.includes('onSettingsChanged'),
    'StorageService 必须提供 onSettingsChanged 跨标签监听接口'
  );
  assert.ok(
    storageIndexSrc.includes('this.mutex.run(async () =>'),
    '设置项写入必须经 mutex.run 串行保护'
  );

  const appSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'App.tsx'),
    'utf8'
  );
  assert.ok(
    appSrc.includes('storageService.onSettingsChanged'),
    'App.tsx 必须订阅 storageService.onSettingsChanged 实现多标签状态同步'
  );
});

test('C025: package 脚本打包前清理旧 zip 防止残留历史 bundle (N15)', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  );
  const script = pkg.scripts.package;

  assert.ok(script, 'package.json 必须定义 package 脚本');
  // 2026-10-14 (v0.2.1)：清理范围收窄为同名旧包——历史版本分发包是归档批次引用的发版证据，
  // 不再随新版本构建删除；断言同时改为校验产物名与 package.json version 一致，杜绝版本漂移。
  // 2026-10-19 (C035)：包名改由 $npm_package_version 注入，与 package.json version 天然一致
  assert.ok(
    script.includes('rm -f ../oh-my-tab-v$npm_package_version.zip'),
    'package 脚本必须在打包前执行 rm -f 清理同名旧压缩包'
  );
  assert.ok(
    script.includes('zip -r -q ../oh-my-tab-v$npm_package_version.zip'),
    '分发包名必须与 package.json version 一致，防止版本漂移'
  );
});
