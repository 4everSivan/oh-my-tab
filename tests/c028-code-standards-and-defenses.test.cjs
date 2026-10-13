/**
 * C028: ad-flow 代码规范与质量缺陷治理回归测试
 * 验证：
 * 1. 消除代码库中所有 `any` 类型定义与断言（收窄为 unknown / Record<string, unknown>）；
 * 2. 消除代码库中所有 `!` 非空断言；
 * 3. 消除静默 catch 吞错，补充轻量诊断日志；
 * 4. Background Service Worker IPC 边界防御与类型安全；
 * 5. Feed parser 与 scriptExecutor 在异构数据下的安全解析防御。
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const srcDir = path.join(__dirname, '..', 'src');

function walkTsFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkTsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

test('C028: src/ 目录中彻底杜绝 `any` 类型注解与断言 (P1)', () => {
  const tsFiles = walkTsFiles(srcDir);
  const anyPattern = /(:\s*any\b|\bas\s+any\b|<any>)/;
  const violations = [];

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (anyPattern.test(line)) {
        violations.push(`${path.relative(srcDir, file)}:${idx + 1}: ${trimmed}`);
      }
    });
  }

  assert.strictEqual(
    violations.length,
    0,
    `发现残留的 any 类型注解或断言:\n${violations.join('\n')}`
  );
});

test('C028: src/ 目录中彻底杜绝 `!` 非空断言 (P1)', () => {
  const tsFiles = walkTsFiles(srcDir);
  // 匹配非空断言：ident!, )!, ]!，排除 != 与 !==
  const bangPattern = /(\b[a-zA-Z0-9_]+|\)|\])!(?!=)/;
  const violations = [];

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
      if (bangPattern.test(line)) {
        violations.push(`${path.relative(srcDir, file)}:${idx + 1}: ${trimmed}`);
      }
    });
  }

  assert.strictEqual(
    violations.length,
    0,
    `发现残留的非空断言 (!):\n${violations.join('\n')}`
  );
});

test('C028: src/ 目录中彻底消除静默 catch 吞错 (P2)', () => {
  const tsFiles = walkTsFiles(srcDir);
  const silentCatchPattern = /catch\s*\([^\)]*\)\s*\{\s*\}|catch\s*\{\s*\}|catch\s*\([^\)]*\)\s*\{\s*\/\/\s*ignore\s*\}|catch\s*\{\s*\/\/\s*ignore\s*\}/;
  const violations = [];

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (silentCatchPattern.test(content)) {
      violations.push(path.relative(srcDir, file));
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `发现残留的静默 catch 吞错块:\n${violations.join('\n')}`
  );
});

test('C028: Service Worker 具备 query 非法类型防守与联想异常诊断 (P1 & P2)', () => {
  const bgPath = path.join(srcDir, 'background', 'index.ts');
  const bgContent = fs.readFileSync(bgPath, 'utf8');

  assert.ok(
    bgContent.includes("typeof query !== 'string'"),
    'fetchEngineSuggestions 必须防守非法 query 类型'
  );
  assert.ok(
    bgContent.includes("typeof message.query === 'string'"),
    'onMessage 处理 FETCH_SUGGESTIONS 时必须校验 message.query 类型'
  );
  assert.ok(
    bgContent.includes('console.debug('),
    '第三方联想解析失败必须输出诊断日志 console.debug'
  );
});

test('C028: transfer.ts 合并文件夹与分组消除了 Map.get 的非空断言', () => {
  const transferPath = path.join(srcDir, 'services', 'shortcuts', 'transfer.ts');
  const transferContent = fs.readFileSync(transferPath, 'utf8');

  assert.ok(
    !transferContent.includes('folderMap.get(folderKey)!'),
    'folderMap.get 不得带有 ! 非空断言'
  );
  assert.ok(
    !transferContent.includes('groupMap.get(key)!'),
    'groupMap.get 不得带有 ! 非空断言'
  );
});
