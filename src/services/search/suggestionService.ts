/**
 * 搜索联想服务 (T13 & C012)
 * 支持多源搜索联想请求、Chrome MV3 Background Worker 代理与本地 Vite 代理
 * 遵从用户诉求：彻底不记录任何本地搜索历史
 */

const REQUEST_TIMEOUT_MS = 2000;

export interface SuggestionItem {
  text: string;
}

/**
 * 带超时的 fetch 包装
 */
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

/**
 * GitHub 联想辅助（内置常见语法辅助）
 */
export function getGitHubSuggestions(query: string): string[] {
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

/**
 * 判断是否在本地开发服务器环境
 */
function isDevServer(): boolean {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
}

/**
 * 直接/代理请求搜索引擎联想
 */
async function fetchDirectSuggestions(query: string, engineId: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const useDevProxy = isDevServer();

  let url = '';
  switch (engineId) {
    case 'bing':
      url = useDevProxy
        ? `/api/suggest-bing/osjson.aspx?query=${encodeURIComponent(trimmed)}`
        : `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(trimmed)}`;
      break;
    case 'google':
      url = useDevProxy
        ? `/api/suggest-google/complete/search?client=firefox&q=${encodeURIComponent(trimmed)}`
        : `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(trimmed)}`;
      break;
    case 'bilibili':
      url = useDevProxy
        ? `/api/suggest-bilibili/main/suggest?term=${encodeURIComponent(trimmed)}`
        : `https://s.search.bilibili.com/main/suggest?term=${encodeURIComponent(trimmed)}`;
      break;
    case 'github':
      return getGitHubSuggestions(trimmed);
    default:
      url = useDevProxy
        ? `/api/suggest-bing/osjson.aspx?query=${encodeURIComponent(trimmed)}`
        : `https://api.bing.com/osjson.aspx?query=${encodeURIComponent(trimmed)}`;
  }

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();

    if (engineId === 'bilibili') {
      if (data?.result?.tag && Array.isArray(data.result.tag)) {
        return data.result.tag.map((item: { value: string }) => item.value).slice(0, 8);
      }
      return [];
    }

    // Google, Bing, Baidu OpenSearch 标准格式: [query, [item1, item2, ...]]
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].slice(0, 8);
    }
    return [];
  } catch {
    // 降级尝试备选通用接口
    try {
      const backupUrl = useDevProxy
        ? `/api/suggest-baidu/su?wd=${encodeURIComponent(trimmed)}&action=opensearch`
        : `https://suggestion.baidu.com/su?wd=${encodeURIComponent(trimmed)}&action=opensearch`;
      const res = await fetchWithTimeout(backupUrl);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1].slice(0, 8);
      }
    } catch {
      // 静默失败，返回空
    }
    return [];
  }
}

/**
 * 多源引擎搜索联想主方法
 * 1. 优先通过 Chrome MV3 Background Service Worker (持有 host_permissions) 跨域代理获取；
 * 2. 在开发环境或非扩展环境通过 Vite Proxy 代理转发获取；
 * 3. 遵从用户诉求：彻底不记录也不呈现任何本地搜索历史。
 */
export async function fetchSuggestions(
  query: string,
  engineId: string
): Promise<SuggestionItem[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  // 1. Chrome 扩展环境：通过 Background Worker 转发
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const response = await new Promise<{ success?: boolean; suggestions?: string[] }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_SUGGESTIONS', query: trimmed, engineId },
          (res) => {
            if (chrome.runtime.lastError || !res) {
              resolve({ success: false, suggestions: [] });
            } else {
              resolve(res);
            }
          }
        );
      });

      if (response?.success && Array.isArray(response.suggestions) && response.suggestions.length > 0) {
        return response.suggestions
          .filter((text) => text && text.toLowerCase() !== trimmed.toLowerCase())
          .slice(0, 8)
          .map((text) => ({ text }));
      }
    } catch {
      // 扩展通信异常时降级至直接/代理请求
    }
  }

  // 2. 本地开发环境或通用前端环境
  const remoteResults = await fetchDirectSuggestions(trimmed, engineId);
  return remoteResults
    .filter((text) => text && text.toLowerCase() !== trimmed.toLowerCase())
    .slice(0, 8)
    .map((text) => ({ text }));
}
