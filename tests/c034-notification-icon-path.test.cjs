const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./helpers/load-ts.cjs');

// ── C034 专注计时系统通知图标指向扩展包内真实文件 ──────────────

const root = path.join(__dirname, '..');
const EXTENSION_ORIGIN = 'chrome-extension://test-id/';

function installFakeChrome() {
  const created = [];
  globalThis.chrome = {
    runtime: { getURL: (p) => EXTENSION_ORIGIN + p.replace(/^\//, ''), lastError: undefined },
    notifications: {
      create: (options, callback) => created.push({ options, callback }),
    },
  };
  return created;
}

test('C034: notify.send 以 runtime.getURL 解析的真实图标创建通知并提供错误回调', async (t) => {
  const created = installFakeChrome();
  t.after(() => delete globalThis.chrome);
  const { WidgetRegistry, NOTIFICATION_ICON_PATH } = require('../src/contract/registry.ts');

  const registry = new WidgetRegistry();
  registry.register(
    {
      typeId: 'test-notify',
      contractVersion: 1,
      contentVersion: 1,
      displayName: 'notify',
      icon: 'Bell',
      defaultSpan: 6,
      supportedSpans: [6],
      capabilities: { notify: true },
      syncPolicy: 'optIn',
    },
    () => null
  );
  const host = registry.createHostContext({ instanceId: 'i1', typeId: 'test-notify' }, {});
  await host.notify.send('专注结束', '恭喜完成 25 分钟专注！');

  assert.equal(created.length, 1);
  const { options, callback } = created[0];
  assert.equal(options.iconUrl, EXTENSION_ORIGIN + NOTIFICATION_ICON_PATH);
  assert.equal(typeof callback, 'function', '必须提供回调以读取 runtime.lastError，避免静默失败');

  const iconFile = path.join(root, 'public', NOTIFICATION_ICON_PATH);
  assert.ok(fs.existsSync(iconFile), `通知图标必须存在于扩展包：public/${NOTIFICATION_ICON_PATH}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public', 'manifest.json'), 'utf8'));
  assert.ok(Object.values(manifest.icons).includes(NOTIFICATION_ICON_PATH), '通知图标须与 manifest icons 声明一致');
});
