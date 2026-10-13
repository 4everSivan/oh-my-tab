/**
 * 安全声明式数据源提取引擎 (T18 & C024)
 * 严格遵循 Chrome MV3 CSP 规范（零动态代码求值），
 * 通过安全属性路径解析与模式映射将接口响应数据提纯为标准 ParsedFeedItem[]
 */

import { ParsedFeedItem } from './types';
import { cleanHtmlText } from './feedParser';

export interface ScriptExecutionResult {
  success: boolean;
  items: ParsedFeedItem[];
  error?: string;
}

/**
 * 安全解析对象深层路径（例如 "user.profile.name" 或 "items"）
 */
function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
  let curr: unknown = obj;
  for (const part of parts) {
    if (curr == null || typeof curr !== 'object') return undefined;
    curr = (curr as Record<string, unknown>)[part];
  }
  return curr;
}

/**
 * 从脚本或声明配置中提取映射规则
 */
interface FieldMappingRule {
  itemsPath?: string;
  idField?: string;
  titleField?: string;
  linkField?: string;
  summaryField?: string;
  pubDateField?: string;
  authorField?: string;
}

function parseMappingRule(script: string): FieldMappingRule {
  const rule: FieldMappingRule = {};
  const trimmed = script.trim();

  // 若为纯 JSON 配置形态，如 {"items": "items", "title": "full_name", ...}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        itemsPath: parsed.items || parsed.itemsPath,
        idField: parsed.id || parsed.idField,
        titleField: parsed.title || parsed.titleField,
        linkField: parsed.link || parsed.linkField || parsed.url,
        summaryField: parsed.summary || parsed.summaryField || parsed.description,
        pubDateField: parsed.pubDate || parsed.pubDateField || parsed.date,
        authorField: parsed.author || parsed.authorField,
      };
    } catch {
      // 降级为正则提取
    }
  }

  // 从 JS 代码字面量中安全提炼字段名（如 `title: repo.full_name`, `link: repo.html_url`）
  const itemsMatch = trimmed.match(/data\.([a-zA-Z0-9_$]+)/);
  if (itemsMatch) rule.itemsPath = itemsMatch[1];

  const idMatch = trimmed.match(/id:\s*(?:String\()?([a-zA-Z0-9_$.]+)/);
  if (idMatch) rule.idField = idMatch[1].replace(/^[a-zA-Z0-9_$]+\./, '');

  const titleMatch = trimmed.match(/title:\s*([a-zA-Z0-9_$.]+)/);
  if (titleMatch) rule.titleField = titleMatch[1].replace(/^[a-zA-Z0-9_$]+\./, '');

  const linkMatch = trimmed.match(/(?:link|url):\s*([a-zA-Z0-9_$.]+)/);
  if (linkMatch) rule.linkField = linkMatch[1].replace(/^[a-zA-Z0-9_$]+\./, '');

  const summaryMatch = trimmed.match(/(?:summary|description):\s*([a-zA-Z0-9_$.]+)/);
  if (summaryMatch) rule.summaryField = summaryMatch[1].replace(/^[a-zA-Z0-9_$]+\./, '');

  const dateMatch = trimmed.match(/(?:pubDate|date):\s*([a-zA-Z0-9_$.]+)/);
  if (dateMatch) rule.pubDateField = dateMatch[1].replace(/^[a-zA-Z0-9_$]+\./, '');

  return rule;
}

/**
 * 在受控无 eval 环境中执行安全数据转换
 * @param script 用户输入的映射配置或脚本规范
 * @param rawText 接口响应原始文本
 * @param _url 请求目标 URL
 */
export async function executeScriptTransform(
  script: string,
  rawText: string,
  _url: string
): Promise<ScriptExecutionResult> {
  const trimmedScript = (script || '').trim();
  if (!trimmedScript) {
    return { success: false, items: [], error: '转换规则或脚本配置为空' };
  }

  // 1. 预先解析 JSON
  let jsonData: unknown = null;
  try {
    jsonData = JSON.parse(rawText);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      items: [],
      error: `接口返回的内容非合法 JSON 格式: ${msg}`,
    };
  }

  try {
    const rule = parseMappingRule(trimmedScript);

    // 2. 定位列表数据
    let rawItems: unknown[] = [];
    const itemsFromPath = rule.itemsPath ? getByPath(jsonData, rule.itemsPath) : undefined;
    if (Array.isArray(jsonData)) {
      rawItems = jsonData;
    } else if (Array.isArray(itemsFromPath)) {
      rawItems = itemsFromPath;
    } else if (jsonData && typeof jsonData === 'object') {
      const obj = jsonData as Record<string, unknown>;
      if (Array.isArray(obj.items)) {
        rawItems = obj.items;
      } else if (Array.isArray(obj.data)) {
        rawItems = obj.data;
      } else if (Array.isArray(obj.results)) {
        rawItems = obj.results;
      } else if (Array.isArray(obj.list)) {
        rawItems = obj.list;
      } else {
        return {
          success: false,
          items: [],
          error: '未在数据中识别到数组列表（请确保返回内容包含 items / data / results 数组或为顶层数组）',
        };
      }
    } else {
      return {
        success: false,
        items: [],
        error: '未在数据中识别到数组列表（请确保返回内容包含 items / data / results 数组或为顶层数组）',
      };
    }

    // 3. 安全映射为 ParsedFeedItem 数组（至多保留 30 条）
    const normalizedItems: ParsedFeedItem[] = rawItems.slice(0, 30).map((item: unknown, idx: number) => {
      if (!item || typeof item !== 'object') {
        return {
          id: `script-item-${idx}`,
          title: String(item || '无标题'),
          link: '',
          pubDate: Date.now(),
          summary: '',
        };
      }

      const record = item as Record<string, unknown>;
      const userObj = record.user && typeof record.user === 'object' ? (record.user as Record<string, unknown>) : undefined;
      const ownerObj = record.owner && typeof record.owner === 'object' ? (record.owner as Record<string, unknown>) : undefined;

      // ID
      const rawId =
        (rule.idField && getByPath(record, rule.idField)) ||
        record.id ||
        record.link ||
        record.html_url ||
        record.url ||
        `script-item-${idx}`;

      // 标题
      let rawTitle =
        (rule.titleField && getByPath(record, rule.titleField)) ||
        record.title ||
        record.full_name ||
        record.name ||
        '无标题';

      // 若为 GitHub 仓库形态，附带展示星标
      if (record.stargazers_count !== undefined && !String(rawTitle).includes('★')) {
        rawTitle = `${rawTitle} ★ ${Number(record.stargazers_count).toLocaleString()}`;
      }

      // 链接
      const rawLink =
        (rule.linkField && getByPath(record, rule.linkField)) ||
        record.link ||
        record.html_url ||
        record.url ||
        '';

      // 摘要
      const rawSummary =
        (rule.summaryField && getByPath(record, rule.summaryField)) ||
        record.summary ||
        record.description ||
        record.body ||
        record.content ||
        '';

      // 时间
      const rawDate =
        (rule.pubDateField && getByPath(record, rule.pubDateField)) ||
        record.pubDate ||
        record.pushed_at ||
        record.updated_at ||
        record.created_at ||
        record.date ||
        Date.now();

      // 作者
      const rawAuthor =
        (rule.authorField && getByPath(record, rule.authorField)) ||
        record.author ||
        userObj?.login ||
        ownerObj?.login;

      return {
        id: String(rawId),
        title: cleanHtmlText(String(rawTitle), 100),
        link: String(rawLink),
        pubDate: (typeof rawDate === 'number' || typeof rawDate === 'string' || rawDate instanceof Date) ? (rawDate as string | number | Date) : Date.now(),
        summary: cleanHtmlText(String(rawSummary), 140),
        author: rawAuthor ? String(rawAuthor) : undefined,
      };
    });

    return {
      success: true,
      items: normalizedItems,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      items: [],
      error: `数据安全解析异常: ${errorMsg}`,
    };
  }
}
