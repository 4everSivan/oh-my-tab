import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'vite';

/** 以 package.json 的 SemVer 覆盖扩展 manifest 版本，保证全局单一版本号 (C035) */
export function syncManifestVersion(manifestText: string, version: string): string {
  const manifest = JSON.parse(manifestText);
  manifest.version = version;
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function manifestVersionPlugin(version: string): Plugin {
  return {
    name: 'oh-my-tab:manifest-version',
    apply: 'build',
    writeBundle(options) {
      if (!options.dir) return;
      const manifestPath = join(options.dir, 'manifest.json');
      if (!existsSync(manifestPath)) {
        this.error(`未找到构建产物 manifest.json：${manifestPath}`);
      }
      writeFileSync(manifestPath, syncManifestVersion(readFileSync(manifestPath, 'utf8'), version));
    },
  };
}
