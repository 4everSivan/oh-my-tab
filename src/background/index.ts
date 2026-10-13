/**
 * Chrome 扩展后台 Service Worker (MV3)
 * 具备 host_permissions 权限，负责代理跨域搜索联想请求，规避页面端 CORS 限制
 */

const REQUEST_TIMEOUT_MS = 2000;

async function fetchWithTimeout(
  url: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; statusText: string; text: string }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      return { ok: false, status: response.status, statusText: response.statusText, text: '' };
    }
    const text = await response.text();
    return { ok: true, status: response.status, statusText: response.statusText, text };
  } finally {
    clearTimeout(id);
  }
}

async function fetchBingSuggestions(query: string): Promise<string[]> {
  const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok || !res.text) return [];
  try {
    const data = JSON.parse(res.text);
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 8);
    }
  } catch (err: unknown) {
    console.debug('[ServiceWorker] Failed to parse Bing suggestions:', err);
  }
  return [];
}

async function fetchGoogleSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok || !res.text) return [];
  try {
    const data = JSON.parse(res.text);
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 8);
    }
  } catch (err: unknown) {
    console.debug('[ServiceWorker] Failed to parse Google suggestions:', err);
  }
  return [];
}

async function fetchBilibiliSuggestions(query: string): Promise<string[]> {
  const url = `https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok || !res.text) return [];
  try {
    const data = JSON.parse(res.text);
    if (data?.result?.tag && Array.isArray(data.result.tag)) {
      return data.result.tag.map((item: { value: string }) => item.value).slice(0, 8);
    }
  } catch (err: unknown) {
    console.debug('[ServiceWorker] Failed to parse Bilibili suggestions:', err);
  }
  return [];
}

async function fetchBaiduSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&action=opensearch`;
  const res = await fetchWithTimeout(url);
  if (!res.ok || !res.text) return [];
  try {
    const data = JSON.parse(res.text);
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 8);
    }
  } catch (err: unknown) {
    console.debug('[ServiceWorker] Failed to parse Baidu suggestions:', err);
  }
  return [];
}

function getGitHubSuggestions(query: string): string[] {
  const q = query.toLowerCase();
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
  return presets.filter((p) => p.includes(q)).slice(0, 5);
}

export async function fetchEngineSuggestions(query: string, engineId: string): Promise<string[]> {
  if (typeof query !== 'string') return [];
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    switch (engineId) {
      case 'bing':
        return await fetchBingSuggestions(trimmed);
      case 'google':
        return await fetchGoogleSuggestions(trimmed);
      case 'bilibili':
        return await fetchBilibiliSuggestions(trimmed);
      case 'github':
        return getGitHubSuggestions(trimmed);
      case 'baidu':
        return await fetchBaiduSuggestions(trimmed);
      default:
        return await fetchBingSuggestions(trimmed);
    }
  } catch (err: unknown) {
    // 遵从用户选择，不静默向未选定的第三方引擎泄露搜索词
    console.debug('[ServiceWorker] Engine suggestion request failed:', err);
    return [];
  }
}

function isValidHttpUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// 监听扩展内部前端页面发来的消息
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FETCH_SUGGESTIONS') {
      const query = typeof message.query === 'string' ? message.query : '';
      const engineId = typeof message.engineId === 'string' ? message.engineId : 'bing';
      fetchEngineSuggestions(query, engineId)
        .then((suggestions) => {
          sendResponse({ success: true, suggestions });
        })
        .catch((error: unknown) => {
          console.warn('[ServiceWorker] Suggestion fetch error:', error);
          sendResponse({ success: false, suggestions: [], error: String(error) });
        });
      return true;
    }

    if (message?.type === 'FETCH_FEED') {
      const { url, timeoutMs } = message;
      if (!url || typeof url !== 'string' || !isValidHttpUrl(url)) {
        sendResponse({ success: false, text: '', error: '无效或不支持的请求地址协议' });
        return true;
      }

      const effectiveTimeout = Math.max(Number(timeoutMs) || 15000, 15000);

      fetchWithTimeout(url, effectiveTimeout, {
        headers: {
          Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, application/json, text/plain, */*',
        },
      })
        .then((res) => {
          if (!res.ok) {
            sendResponse({ success: false, text: '', error: `HTTP ${res.status}: ${res.statusText}` });
            return;
          }
          sendResponse({ success: true, text: res.text });
        })
        .catch((directError) => {
          // 消除向公共代理的静默外传，保全用户私有源与 token 安全
          sendResponse({ success: false, text: '', error: String(directError) });
        });
      return true;
    }
  });
}
