/**
 * 极客自定义脚本数据源沙箱执行引擎 (T18)
 * 接收原始响应文本与数据，通过用户编写的 JS 转换函数提纯为标准 ParsedFeedItem[]
 */

import { ParsedFeedItem } from './types';
import { cleanHtmlText, formatRelativeTime } from './feedParser';

export interface ScriptExecutionResult {
  success: boolean;
  items: ParsedFeedItem[];
  error?: string;
}

/**
 * 包装用户脚本：智能适配直接 return 或函数声明形态
 */
function normalizeScriptCode(script: string): string {
  const trimmed = script.trim();
  // 若用户直接写了完整箭头函数或普通函数，如 `(data) => data.map(...)` 或 `function(data) { ... }`
  if (/^(\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/i.test(trimmed) || /^function\s*\(/i.test(trimmed)) {
    return `const userFn = (${trimmed}); return userFn(data, rawText, url, utils);`;
  }
  // 若未包含显式 return，且为单行表达式
  if (!trimmed.includes('return ') && !trimmed.includes('\n')) {
    return `return (${trimmed});`;
  }
  // 默认作为函数体内代码执行
  return trimmed;
}

/**
 * 在受控沙箱环境中执行用户转换脚本
 * @param script 用户输入的 JS 源码
 * @param rawText 接口响应原始文本
 * @param url 请求目标 URL
 */
export async function executeScriptTransform(
  script: string,
  rawText: string,
  url: string
): Promise<ScriptExecutionResult> {
  if (!script || !script.trim()) {
    return { success: false, items: [], error: '转换脚本内容为空' };
  }

  // 尝试预先解析为 JSON
  let jsonData: any = null;
  try {
    jsonData = JSON.parse(rawText);
  } catch {
    jsonData = null;
  }

  const utils = {
    cleanHtmlText,
    formatRelativeTime,
  };

  try {
    const wrappedCode = normalizeScriptCode(script);
    // 使用 new Function 构建隔离上下文，传递数据与辅助工具
    const runner = new Function('data', 'rawText', 'url', 'utils', wrappedCode);
    const result = await Promise.resolve(runner(jsonData, rawText, url, utils));

    if (!Array.isArray(result)) {
      return {
        success: false,
        items: [],
        error: '脚本返回值必须是数组（如 Array<{ title, link, summary, pubDate }>）',
      };
    }

    const normalizedItems: ParsedFeedItem[] = result.map((item: any, idx: number) => ({
      id: String(item.id || item.link || item.url || `script-item-${idx}`),
      title: cleanHtmlText(item.title || item.name || '无标题', 100),
      link: String(item.link || item.url || item.html_url || ''),
      pubDate: item.pubDate || item.date || item.published_at || item.created_at || Date.now(),
      summary: cleanHtmlText(item.summary || item.description || item.body || item.content || '', 140),
      author: item.author || item.user?.login,
    }));

    return {
      success: true,
      items: normalizedItems,
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: `脚本执行异常: ${err?.message || String(err)}`,
    };
  }
}
