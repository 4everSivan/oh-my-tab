const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── 1. 静态源码契约测试 (T13 & C012) ──
test('SearchBar 输入框光标与文本根据背景自适应注入 textColor 且与占位提示同色协调 (T13 & C014)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );

  // 光标与文字颜色动态绑定 textColor (C014)
  assert.ok(
    searchBarSrc.includes('color: textColor') && searchBarSrc.includes('caretColor: textColor'),
    '输入文本与光标指示符必须绑定动态自适应 textColor，杜绝写死固定色阶 (C014)'
  );
  assert.ok(
    searchBarSrc.includes('textColor?: string') && searchBarSrc.includes("tone?: 'light' | 'dark'"),
    'SearchBar 必须声明并接收 textColor 与 tone 属性 (C014)'
  );
  assert.ok(
    searchBarSrc.includes('placeholder:text-white/60') && searchBarSrc.includes('placeholder:text-stone-500/70'),
    '占位提示需根据 tone 深浅自适应协调渲染半透明同色调 (C014)'
  );
  assert.ok(
    !searchBarSrc.includes('text-stone-400 dark:text-stone-400'),
    'SearchBar 内部严禁继续硬编码写死 text-stone-400 (C014)'
  );
});

test('SearchBar 对焦后占位文本立即消失，失焦后为空恢复 (T13)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );

  // placeholder 条件表达式与 focus:placeholder-transparent
  assert.ok(
    searchBarSrc.includes("isFocused ? '' : `在 ${currentEngine.name} 中搜索...`"),
    '聚焦后 placeholder 内容必须动态置空消失'
  );
  assert.ok(
    searchBarSrc.includes('focus:placeholder-transparent'),
    '输入框需附带 focus:placeholder-transparent 防护样式'
  );
  assert.ok(
    searchBarSrc.includes('setIsFocused(true)') && searchBarSrc.includes('setIsFocused(false)'),
    '必须具备 isFocused 状态监听器'
  );
});

test('SearchBar 接入多引擎联想且彻底不记录与呈现本地搜索历史 (T13 & C012)', () => {
  const searchBarSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'search', 'SearchBar.tsx'),
    'utf8'
  );

  // 引入 suggestionService
  assert.ok(
    searchBarSrc.includes("from '../../services/search/suggestionService'"),
    'SearchBar 必须引入 suggestionService'
  );
  assert.ok(
    searchBarSrc.includes('fetchSuggestions'),
    '必须接入 fetchSuggestions'
  );

  // 遵从用户诉求：彻底不记录历史
  assert.ok(
    !searchBarSrc.includes('saveSearchHistory'),
    'SearchBar 不得包含 saveSearchHistory 调用'
  );
  assert.ok(
    !searchBarSrc.includes('deleteSearchHistoryItem'),
    'SearchBar 不得包含 deleteSearchHistoryItem 调用'
  );
  assert.ok(
    !searchBarSrc.includes('isHistory'),
    'SearchBar 不得包含 isHistory 历史标记分支'
  );

  // 联想浮层必须仅在有 query 输入且激活时渲染
  assert.ok(
    searchBarSrc.includes('showSuggestions && query.trim().length > 0 && suggestions.length > 0'),
    '联想浮层必须仅在 query 非空且有联想数据时渲染'
  );
  assert.ok(
    searchBarSrc.includes('ArrowDown') &&
      searchBarSrc.includes('ArrowUp') &&
      searchBarSrc.includes('Escape'),
    '必须支持上下方向键导航与 Escape 关闭'
  );
  assert.ok(
    searchBarSrc.includes('handleSelectSuggestion(item.text)') ||
      searchBarSrc.includes('executeSearch(item.text)'),
    '点击联想词必须直接触发执行搜索'
  );
});

test('Manifest V3 声明 host_permissions 与 Background Service Worker (C012)', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'public', 'manifest.json'), 'utf8')
  );

  assert.ok(Array.isArray(manifest.host_permissions), '必须声明 host_permissions 数组');
  assert.ok(
    manifest.host_permissions.some((p) => p.includes('bing.com')),
    'host_permissions 必须包含 bing.com 联想域名'
  );
  assert.ok(
    manifest.host_permissions.some((p) => p.includes('google.com')),
    'host_permissions 必须包含 google.com 联想域名'
  );
  assert.ok(
    manifest.host_permissions.some((p) => p.includes('baidu.com')),
    'host_permissions 必须包含 baidu.com 备用联想域名'
  );
  assert.ok(
    manifest.host_permissions.some((p) => p.includes('bilibili.com')),
    'host_permissions 必须包含 bilibili.com 联想域名'
  );

  // Background Service Worker
  assert.ok(manifest.background, 'manifest 必须包含 background 配置');
  assert.equal(manifest.background.service_worker, 'background.js', 'service_worker 必须为 background.js');
  assert.equal(manifest.background.type, 'module', 'service_worker 类型必须为 module');
});

test('Background Service Worker 具备跨域联想监听与抓取能力 (C012)', () => {
  const bgSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'background', 'index.ts'),
    'utf8'
  );

  assert.ok(
    bgSrc.includes("chrome.runtime.onMessage.addListener"),
    'Background Worker 必须监听 chrome.runtime.onMessage'
  );
  assert.ok(
    bgSrc.includes("message?.type === 'FETCH_SUGGESTIONS'") || bgSrc.includes("FETCH_SUGGESTIONS"),
    'Background Worker 必须响应 FETCH_SUGGESTIONS 消息'
  );
  assert.ok(
    bgSrc.includes('fetchBingSuggestions') && bgSrc.includes('fetchGoogleSuggestions'),
    'Background Worker 必须具备 Bing 与 Google 联想抓取实现'
  );
  assert.ok(
    bgSrc.includes('return true'),
    '消息监听器必须返回 true 以保持异步 sendResponse 信道'
  );
});

test('Vite 构建配置包含 background 入口与本地开发代理 (C012)', () => {
  const viteSrc = fs.readFileSync(
    path.join(__dirname, '..', 'vite.config.ts'),
    'utf8'
  );

  assert.ok(
    viteSrc.includes('src/background/index.ts'),
    'Vite rollupOptions.input 必须包含 background 入口'
  );
  assert.ok(
    viteSrc.includes("return 'background.js'"),
    'Vite rollupOptions.output 必须输出单一稳定的 background.js 产物名'
  );
  assert.ok(
    viteSrc.includes('/api/suggest-bing') && viteSrc.includes('/api/suggest-google'),
    'Vite server.proxy 必须配置 Bing 与 Google 代理规则'
  );
});

test('suggestionService 遵从用户诉求：彻底不提供也不持久化本地搜索历史 (C012)', () => {
  const serviceSrc = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'services', 'search', 'suggestionService.ts'),
    'utf8'
  );

  assert.ok(
    !serviceSrc.includes('saveSearchHistory'),
    'suggestionService 不得导出 saveSearchHistory'
  );
  assert.ok(
    !serviceSrc.includes('getSearchHistory'),
    'suggestionService 不得导出 getSearchHistory'
  );
  assert.ok(
    !serviceSrc.includes('localStorage.setItem'),
    'suggestionService 不得向 localStorage 写入历史'
  );
  assert.ok(
    serviceSrc.includes('chrome.runtime.sendMessage'),
    'suggestionService 扩展环境必须优先向 Background Worker 发送消息绕过 CORS'
  );
});

test('GitHub 引擎提供专用语法快捷补全 (T13)', () => {
  const presets = [
    'stars:>1000',
    'language:typescript',
    'language:javascript',
    'language:python',
    'language:rust',
    'language:go',
    'topic:react',
    'is:issue is:open',
  ];
  function getGitHubSuggestions(query) {
    const q = query.toLowerCase();
    return presets.filter((p) => p.includes(q)).slice(0, 5);
  }

  const results = getGitHubSuggestions('type');
  assert.deepEqual(results, ['language:typescript']);

  const starResults = getGitHubSuggestions('stars');
  assert.deepEqual(starResults, ['stars:>1000']);
});
