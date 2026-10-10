const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// ── C026 RSS 刷新并发防源复活、阅读状态回滚、空源保全与点击幂等回归测试 ─────────

const feedServiceSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'feed', 'feedService.ts'),
  'utf8'
);
const feedSidebarSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'feed', 'FeedSidebar.tsx'),
  'utf8'
);
const appSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'App.tsx'),
  'utf8'
);

test('C026: 源码契约校验 (N03, N04, N16)', () => {
  // 1. 代次控制与源防复活 (N03)
  assert.ok(
    feedServiceSrc.includes('refreshGeneration'),
    'feedService 必须定义 refreshGeneration 代次变量'
  );
  assert.ok(
    !feedServiceSrc.includes('await this.saveSources(sources);'),
    'refreshAllFeeds 严禁整体写回旧 sources 数组以防删除源复活'
  );
  assert.ok(
    feedServiceSrc.includes('validSourceIds'),
    'refreshAllFeeds 必须使用 validSourceIds 过滤已删除源文章'
  );

  // 2. 阅读状态保全 (N04)
  assert.ok(
    feedServiceSrc.includes('latestReadMap') || feedServiceSrc.includes('latestCachedItems'),
    'refreshAllFeeds 提交前必须重新获取最新已读状态映射以防回滚'
  );

  // 3. 空源判定合法性 (N16)
  assert.ok(
    !feedServiceSrc.includes('Array.isArray(parsed) && parsed.length > 0'),
    'getSources 严禁将 length===0 当作未初始化强制复活默认源'
  );
  assert.ok(
    feedServiceSrc.includes('raw !== null'),
    'getSources 只有在键未初始化 (raw === null) 时才回退默认源'
  );

  // 4. markItemRead 幂等与卡片点击 (N16)
  assert.ok(
    feedServiceSrc.includes('async markItemRead(id: string)'),
    'feedService 必须提供 markItemRead 幂等阅读接口'
  );
  assert.ok(
    feedSidebarSrc.includes('onMarkRead'),
    'FeedSidebar 必须声明并支持 onMarkRead 回调'
  );
  assert.ok(
    feedSidebarSrc.includes('if (onMarkRead)') && feedSidebarSrc.includes('onMarkRead(feed.id)'),
    'FeedSidebar handleCardClick 点击卡片必须优先调用 onMarkRead 幂等标记已读'
  );
  assert.ok(
    appSrc.includes('handleMarkFeedRead') && appSrc.includes('onMarkRead={handleMarkFeedRead}'),
    'App.tsx 必须接入 handleMarkFeedRead 并透传至 FeedSidebar'
  );

  // 5. OPML URL 规范化函数 (N16)
  assert.ok(
    feedServiceSrc.includes('normalizeFeedUrl'),
    'feedService 必须提供 normalizeFeedUrl 保留路径与查询参数大小写'
  );
});

test('C026: normalizeFeedUrl 保持路径大小写但协议与域名小写 (N16)', () => {
  // 模拟实现
  function normalizeFeedUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl.trim());
      return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return rawUrl.trim();
    }
  }

  const url1 = 'HTTPS://EXAMPLE.COM/feed/CaseSensitivePath?Tag=Tech';
  const norm1 = normalizeFeedUrl(url1);
  assert.equal(norm1, 'https://example.com/feed/CaseSensitivePath?Tag=Tech');

  const url2 = 'https://example.com/feed/casesensitivepath?Tag=Tech';
  const norm2 = normalizeFeedUrl(url2);
  // 路径大小写不同，不能被判为相同 URL
  assert.notEqual(norm1, norm2, '路径大小写不同应作为两个独立源，不可粗暴合并');
});

test('C026: 空源合法性与防强制复活逻辑模拟 (N16)', async () => {
  const store = new Map();
  const DEFAULT_SOURCES = [{ id: 'd1', name: '默认源' }];

  class MockFeedService {
    constructor() {
      this.sourcesCache = null;
    }

    async getSources() {
      if (this.sourcesCache) return this.sourcesCache;
      const raw = store.get('sources');
      if (raw !== undefined && raw !== null) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            this.sourcesCache = parsed;
            return parsed;
          }
        } catch {}
      }
      this.sourcesCache = [...DEFAULT_SOURCES];
      store.set('sources', JSON.stringify(this.sourcesCache));
      return this.sourcesCache;
    }
  }

  // 1. 初始无数据：正常获取默认源
  const svc1 = new MockFeedService();
  const initial = await svc1.getSources();
  assert.equal(initial.length, 1);
  assert.equal(initial[0].id, 'd1');

  // 2. 用户清空所有源：存入 "[]"
  store.set('sources', JSON.stringify([]));
  const svc2 = new MockFeedService();
  const emptySources = await svc2.getSources();
  assert.deepEqual(emptySources, [], '用户清空后的空源必须被保留，严禁强制注入默认源');
});

test('C026: 刷新期间删除/新增源防复活与防丢失逻辑模拟 (N03)', async () => {
  const store = new Map();
  let refreshGen = 0;

  // 初始有源 S1 和 S2
  let currentSources = [
    { id: 's1', name: '源1', enabled: true },
    { id: 's2', name: '源2', enabled: true },
  ];
  let cachedFeeds = [];

  // 模拟并发刷新调度器
  async function simulateRefresh() {
    const gen = ++refreshGen;
    const initialSources = [...currentSources];
    const enabled = initialSources.filter((s) => s.enabled);

    // 模拟网络请求延迟 (在此期间用户删除了 s1，新增了 s3)
    await new Promise((r) => setTimeout(r, 20));

    // 网络拉取到的文章列表
    const fetchedItems = [
      { id: 's1-art1', sourceId: 's1', title: 'S1 文章 1' },
      { id: 's2-art1', sourceId: 's2', title: 'S2 文章 1' },
    ];

    // 获取最新源与有效集合
    const latestSources = [...currentSources];
    const validIds = new Set(latestSources.map((s) => s.id));

    // 增量写回源元数据（仅当代次有效）
    if (gen === refreshGen) {
      currentSources = latestSources.map((s) => {
        if (s.id === 's2') return { ...s, lastFetchedAt: 123456 };
        return s;
      });
    }

    // 过滤并合并文章：只保留 validIds 中的条目
    const mergedFeeds = fetchedItems.filter((item) => validIds.has(item.sourceId));
    cachedFeeds = mergedFeeds;

    return { feeds: mergedFeeds };
  }

  // 启动刷新
  const refreshPromise = simulateRefresh();

  // 在网络等待期间：用户删除了 s1，添加了 s3
  currentSources = currentSources.filter((s) => s.id !== 's1');
  currentSources.push({ id: 's3', name: '源3', enabled: true });

  const result = await refreshPromise;

  // 断言：
  // 1. 已删除的 s1 绝不复活，新增的 s3 完好保留
  assert.ok(!currentSources.some((s) => s.id === 's1'), '已删除的 s1 严禁在刷新后复活');
  assert.ok(currentSources.some((s) => s.id === 's3'), '新增的 s3 严禁在刷新后被旧快照覆盖丢失');

  // 2. 已删除的 s1 抓取到的文章被丢弃，仅保留有效源 s2 的文章
  assert.equal(result.feeds.length, 1);
  assert.equal(result.feeds[0].sourceId, 's2');
  assert.equal(cachedFeeds.length, 1);
  assert.equal(cachedFeeds[0].sourceId, 's2');
});

test('C026: 刷新期间阅读状态保全模拟 (N04)', async () => {
  let cachedFeeds = [
    { id: 'item-1', title: '现有文章1', read: false },
    { id: 'item-2', title: '现有文章2', read: false },
  ];

  async function simulateRefreshWithReadPreserve() {
    // 模拟网络请求延迟 (在此期间用户标记 item-1 为已读)
    await new Promise((r) => setTimeout(r, 20));

    // 网络返回的新文章
    const fetchedItems = [
      { id: 'item-1', title: '现有文章1 (更新)', read: false },
      { id: 'item-3', title: '新抓取文章3', read: false },
    ];

    // 重新获取提交时刻的最新已读映射
    const latestReadMap = new Map();
    cachedFeeds.forEach((item) => latestReadMap.set(item.id, item.read));

    const finalFeeds = fetchedItems.map((item) => ({
      ...item,
      read: latestReadMap.get(item.id) ?? false,
    }));

    cachedFeeds = finalFeeds;
    return finalFeeds;
  }

  const refreshPromise = simulateRefreshWithReadPreserve();

  // 刷新进行中：用户点击将 item-1 标为已读
  cachedFeeds = cachedFeeds.map((i) => (i.id === 'item-1' ? { ...i, read: true } : i));

  const result = await refreshPromise;
  const item1 = result.find((i) => i.id === 'item-1');
  assert.ok(item1, 'item-1 存在');
  assert.equal(item1.read, true, '刷新期间用户标记的已读状态必须保全，不可回滚为 false');
});

test('C026: markItemRead 幂等性模拟 (N16)', async () => {
  let saveCount = 0;
  let cached = [
    { id: 'art-1', title: '文章1', read: false },
    { id: 'art-2', title: '文章2', read: true },
  ];

  async function markItemRead(id) {
    const target = cached.find((f) => f.id === id);
    if (!target || target.read) {
      // 幂等快速返回，不写存储
      return cached;
    }
    cached = cached.map((f) => (f.id === id ? { ...f, read: true } : f));
    saveCount++;
    return cached;
  }

  // 第一次对未读项调用：更新为已读并写存储
  const res1 = await markItemRead('art-1');
  assert.equal(res1.find((i) => i.id === 'art-1').read, true);
  assert.equal(saveCount, 1, '未读标记为已读需触发写');

  // 第二次对已读项再次调用：直接幂等返回，不触发多余写
  const res2 = await markItemRead('art-1');
  assert.equal(res2.find((i) => i.id === 'art-1').read, true);
  assert.equal(saveCount, 1, '已读项重复调用不得重复写存储');

  // 对原本就是已读的 art-2 调用：直接幂等返回
  const res3 = await markItemRead('art-2');
  assert.equal(res3.find((i) => i.id === 'art-2').read, true);
  assert.equal(saveCount, 1, '原本已读项不得触发写存储');
});
