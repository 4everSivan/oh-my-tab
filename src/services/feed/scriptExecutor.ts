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
function getByPath(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = path.split('.').map((p) => p.trim()).filter(Boolean);
  let curr = obj;
  for (const part of parts) {
    if (curr == null || typeof curr !== 'object') return undefined;
    curr = curr[part];
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
  let jsonData: any = null;
  try {
    jsonData = JSON.parse(rawText);
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: `接口返回的内容非合法 JSON 格式: ${err?.message || String(err)}`,
    };
  }

  try {
    const rule = parseMappingRule(trimmedScript);

    // 2. 定位列表数据
    let rawItems: any[] = [];
    if (Array.isArray(jsonData)) {
      rawItems = jsonData;
    } else if (rule.itemsPath && Array.isArray(getByPath(jsonData, rule.itemsPath))) {
      rawItems = getByPath(jsonData, rule.itemsPath);
    } else if (Array.isArray(jsonData.items)) {
      rawItems = jsonData.items;
    } else if (Array.isArray(jsonData.data)) {
      rawItems = jsonData.data;
    } else if (Array.isArray(jsonData.results)) {
      rawItems = jsonData.results;
    } else if (Array.isArray(jsonData.list)) {
      rawItems = jsonData.list;
    } else {
      return {
        success: false,
        items: [],
        error: '未在数据中识别到数组列表（请确保返回内容包含 items / data / results 数组或为顶层数组）',
      };
    }

    // 3. 安全映射为 ParsedFeedItem 数组（至多保留 30 条）
    const normalizedItems: ParsedFeedItem[] = rawItems.slice(0, 30).map((item: any, idx: number) => {
      if (!item || typeof item !== 'object') {
        return {
          id: `script-item-${idx}`,
          title: String(item || '无标题'),
          link: '',
          pubDate: Date.now(),
          summary: '',
        };
      }

      // ID
      const rawId =
        (rule.idField && getByPath(item, rule.idField)) ||
        item.id ||
        item.link ||
        item.html_url ||
        item.url ||
        `script-item-${idx}`;

      // 标题
      let rawTitle =
        (rule.titleField && getByPath(item, rule.titleField)) ||
        item.title ||
        item.full_name ||
        item.name ||
        '无标题';

      // 若为 GitHub 仓库形态，附带展示星标
      if (item.stargazers_count !== undefined && !String(rawTitle).includes('★')) {
        rawTitle = `${rawTitle} ★ ${Number(item.stargazers_count).toLocaleString()}`;
      }

      // 链接
      const rawLink =
        (rule.linkField && getByPath(item, rule.linkField)) ||
        item.link ||
        item.html_url ||
        item.url ||
        '';

      // 摘要
      const rawSummary =
        (rule.summaryField && getByPath(item, rule.summaryField)) ||
        item.summary ||
        item.description ||
        item.body ||
        item.content ||
        '';

      // 时间
      const rawDate =
        (rule.pubDateField && getByPath(item, rule.pubDateField)) ||
        item.pubDate ||
        item.pushed_at ||
        item.updated_at ||
        item.created_at ||
        item.date ||
        Date.now();

      // 作者
      const rawAuthor =
        (rule.authorField && getByPath(item, rule.authorField)) ||
        item.author ||
        item.user?.login ||
        item.owner?.login;

      return {
        id: String(rawId),
        title: cleanHtmlText(String(rawTitle), 100),
        link: String(rawLink),
        pubDate: rawDate,
        summary: cleanHtmlText(String(rawSummary), 140),
        author: rawAuthor ? String(rawAuthor) : undefined,
      };
    });

    return {
      success: true,
      items: normalizedItems,
    };
  } catch (err: any) {
    return {
      success: false,
      items: [],
      error: `数据安全解析异常: ${err?.message || String(err)}`,
    };
  }
}
