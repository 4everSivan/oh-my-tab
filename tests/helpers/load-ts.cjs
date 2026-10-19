/**
 * 测试辅助：用项目自带 typescript 将 src/ 下的 .ts 模块即时转译为 CommonJS，
 * 使行为测试直接 require 真实发货代码，而非在测试内复制一份实现。
 */
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
};

for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, { compilerOptions, fileName: filename });
    module._compile(outputText, filename);
  };
}

/** 内存版 localStorage，供启动快照等依赖 localStorage 的逻辑在 Node 中运行。 */
function createMemoryLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

module.exports = { createMemoryLocalStorage };
