/**
 * Chrome 扩展后台 Service Worker (MV3)
 * 具备 host_permissions 权限，负责代理跨域搜索联想请求，规避页面端 CORS 限制
 */

const REQUEST_TIMEOUT_MS = 2000;

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function fetchBingSuggestions(query: string): Promise<string[]> {
  const url = `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[1])) {
    return data[1].slice(0, 8);
  }
  return [];
}

async function fetchGoogleSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[1])) {
    return data[1].slice(0, 8);
  }
  return [];
}

async function fetchBilibiliSuggestions(query: string): Promise<string[]> {
  const url = `https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(query)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data?.result?.tag && Array.isArray(data.result.tag)) {
    return data.result.tag.map((item: { value: string }) => item.value).slice(0, 8);
  }
  return [];
}

async function fetchBaiduSuggestions(query: string): Promise<string[]> {
  const url = `https://suggestion.baidu.com/su?wd=${encodeURIComponent(query)}&action=opensearch`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (Array.isArray(data) && Array.isArray(data[1])) {
    return data[1].slice(0, 8);
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
      default:
        return await fetchBingSuggestions(trimmed);
    }
  } catch {
    try {
      return await fetchBaiduSuggestions(trimmed);
    } catch {
      return [];
    }
  }
}

// 监听扩展内部前端页面发来的消息
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'FETCH_SUGGESTIONS') {
      const { query, engineId } = message;
      fetchEngineSuggestions(query || '', engineId || 'bing')
        .then((suggestions) => {
          sendResponse({ success: true, suggestions });
        })
        .catch((error) => {
          sendResponse({ success: false, suggestions: [], error: String(error) });
        });
      return true;
    }

    if (message?.type === 'FETCH_FEED') {
      const { url, timeoutMs } = message;
      fetchWithTimeout(url, timeoutMs || 10000)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const text = await res.text();
          sendResponse({ success: true, text });
        })
        .catch((error) => {
          sendResponse({ success: false, text: '', error: String(error) });
        });
      return true;
    }
  });
}
