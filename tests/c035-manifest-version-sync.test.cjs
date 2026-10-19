const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./helpers/load-ts.cjs');

// ── C035 扩展 manifest 版本与 package.json 单一 SemVer 同步 ──────────────

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkg = JSON.parse(read('package.json'));
const { syncManifestVersion, manifestVersionPlugin } = require('../scripts/vite-plugin-manifest-version.ts');

test('C035: syncManifestVersion 以 package 版本覆盖 manifest 且保留其余字段', () => {
  const out = JSON.parse(syncManifestVersion(read('public/manifest.json'), '9.8.7'));
  assert.equal(out.version, '9.8.7');
  assert.deepEqual({ ...out, version: undefined }, { ...JSON.parse(read('public/manifest.json')), version: undefined });
});

test('C035: vite 构建挂载版本同步插件，且仅作用于 build', () => {
  const viteConfig = read('vite.config.ts');
  assert.ok(viteConfig.includes('manifestVersionPlugin(pkg.version)'), 'vite.config.ts 必须以 package.json 版本挂载插件');
  const plugin = manifestVersionPlugin(pkg.version);
  assert.equal(plugin.apply, 'build');
  assert.equal(typeof plugin.writeBundle, 'function');
});

test('C035: 源 manifest 与打包文件名不再硬编码独立版本号', () => {
  assert.equal(JSON.parse(read('public/manifest.json')).version, pkg.version, 'public/manifest.json 与 package.json 版本须一致');
  assert.ok(!/oh-my-tab-v\d+\.\d+\.\d+\.zip/.test(pkg.scripts.package), 'package 脚本 zip 名须引用 $npm_package_version');
  assert.ok(pkg.scripts.package.includes('$npm_package_version'));
});
