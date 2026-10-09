import { Shortcut, ShortcutGroup } from '../storage/types';
import { isValidUrl } from '../../components/shortcuts/Shortcuts';

export interface ShortcutsExportData {
  version: string;
  exportedAt: number;
  generator: string;
  shortcuts?: Shortcut[];
  groups?: ShortcutGroup[];
}

/**
 * 将常用网站列表（或多分组）序列化为标准 JSON 并触发浏览器下载 (T14 & T15)
 */
export function exportShortcutsToJSON(
  data: Shortcut[] | { groups: ShortcutGroup[]; activeShortcuts?: Shortcut[] },
  filename?: string
): void {
  const isMultiGroup = !Array.isArray(data) && 'groups' in data;
  const groups = isMultiGroup ? data.groups : undefined;
  const shortcuts = isMultiGroup
    ? data.activeShortcuts || (groups && groups.length > 0 ? groups[0].shortcuts : [])
    : data;

  const exportData: ShortcutsExportData = {
    version: isMultiGroup ? '2.0' : '1.0',
    exportedAt: Date.now(),
    generator: 'oh-my-tab',
    shortcuts,
    ...(groups ? { groups } : {}),
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `oh-my-tab-shortcuts-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 递归清洗单个条目为规范 Shortcut，支持普通网站及包含嵌套子站点的图标文件夹 (T15)
 */
function sanitizeShortcutItem(record: Record<string, unknown>, fallbackPrefix = 'item'): Shortcut | null {
  if (record.isFolder === true || record.type === 'folder') {
    const rawName = typeof record.name === 'string' ? record.name.trim() : '';
    const cleanName = (rawName || '新建文件夹').slice(0, 30);
    const id = typeof record.id === 'string' && record.id ? record.id : `${fallbackPrefix}-folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const children: Shortcut[] = [];

    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        if (child && typeof child === 'object') {
          const sanitizedChild = sanitizeShortcutItem(child as Record<string, unknown>, `${fallbackPrefix}-child`);
          if (sanitizedChild && !sanitizedChild.isFolder) {
            children.push(sanitizedChild);
          }
        }
      }
    }

    return {
      id,
      name: cleanName,
      url: '',
      isFolder: true,
      children,
    };
  }

  const rawName = typeof record.name === 'string' ? record.name.trim() : '';
  const rawUrl = typeof record.url === 'string' ? record.url.trim() : '';

  if (!rawUrl || !isValidUrl(rawUrl)) return null;
  if (rawUrl.startsWith('itab://') || rawUrl.startsWith('javascript:')) return null;

  const fullUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `https://${rawUrl}`;
  const cleanName = (rawName || fullUrl).slice(0, 30);
  const id = typeof record.id === 'string' && record.id ? record.id : `${fallbackPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return { id, name: cleanName, url: fullUrl };
}

/**
 * 解析并校验导入的 JSON 内容，支持文件夹嵌套、多分组结构及 iTab navConfig 格式自动映射 (T14 & T15)
 */
export function parseShortcutsFromJSON(jsonText: string): {
  valid: Shortcut[];
  groups?: ShortcutGroup[];
  error?: string;
} {
  if (!jsonText || typeof jsonText !== 'string') {
    return { valid: [], error: '导入的文件内容为空' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { valid: [], error: 'JSON 文件格式不合规，无法解析' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: [], error: '未识别到合法的常用网站数据列表' };
  }

  // 分支 1: iTab navConfig 备份格式识别 (T15: 原生保留文件夹结构)
  if ('navConfig' in parsed && Array.isArray((parsed as Record<string, unknown>).navConfig)) {
    const navConfig = (parsed as { navConfig: unknown[] }).navConfig;
    const extractedGroups: ShortcutGroup[] = [];
    const allValidShortcuts: Shortcut[] = [];
    let groupIndex = 1;

    for (const rawGroup of navConfig) {
      if (!rawGroup || typeof rawGroup !== 'object') continue;
      const grp = rawGroup as Record<string, unknown>;
      const groupName = typeof grp.name === 'string' && grp.name.trim() ? grp.name.trim() : `分组 ${groupIndex}`;
      const groupShortcuts: Shortcut[] = [];
      const seenUrls = new Set<string>();

      if (Array.isArray(grp.children)) {
        for (const child of grp.children) {
          if (!child || typeof child !== 'object') continue;
          const rec = child as Record<string, unknown>;

          if (rec.type === 'folder') {
            const folderItem = sanitizeShortcutItem(rec, `itab-${groupIndex}`);
            if (folderItem && folderItem.children && folderItem.children.length > 0) {
              groupShortcuts.push(folderItem);
              allValidShortcuts.push(folderItem);
              for (const sc of folderItem.children) {
                seenUrls.add(sc.url.replace(/\/+$/, '').toLowerCase());
              }
            }
          } else {
            const sanitized = sanitizeShortcutItem(rec, `itab-${groupIndex}`);
            if (sanitized) {
              const norm = sanitized.url.replace(/\/+$/, '').toLowerCase();
              if (!seenUrls.has(norm)) {
                seenUrls.add(norm);
                groupShortcuts.push(sanitized);
                allValidShortcuts.push(sanitized);
              }
            }
          }
        }
      }

      if (groupShortcuts.length > 0) {
        extractedGroups.push({
          id: typeof grp.id === 'string' && grp.id ? `itab-group-${grp.id}` : `group-itab-${groupIndex++}`,
          name: groupName,
          shortcuts: groupShortcuts,
        });
      }
    }

    if (extractedGroups.length > 0) {
      // 优先将包含“主页”或第一组的条目作为根列表直出
      const homeGroup = extractedGroups.find((g) => g.name === '主页') || extractedGroups[0];
      return { valid: homeGroup.shortcuts, groups: extractedGroups };
    }
  }

  // 分支 2: 标准多分组结构 groups: ShortcutGroup[] (T15)
  if ('groups' in parsed && Array.isArray((parsed as Record<string, unknown>).groups)) {
    const rawGroups = (parsed as { groups: unknown[] }).groups;
    const validGroups: ShortcutGroup[] = [];
    const allValidShortcuts: Shortcut[] = [];
    let groupIndex = 1;

    for (const rawGroup of rawGroups) {
      if (!rawGroup || typeof rawGroup !== 'object') continue;
      const grp = rawGroup as Record<string, unknown>;
      const groupName = typeof grp.name === 'string' && grp.name.trim() ? grp.name.trim() : `分组 ${groupIndex}`;
      const rawShortcuts = Array.isArray(grp.shortcuts) ? grp.shortcuts : [];
      const validShortcuts: Shortcut[] = [];

      for (const item of rawShortcuts) {
        if (!item || typeof item !== 'object') continue;
        const sanitized = sanitizeShortcutItem(item as Record<string, unknown>, `group-${groupIndex}`);
        if (sanitized) {
          validShortcuts.push(sanitized);
          allValidShortcuts.push(sanitized);
        }
      }

      validGroups.push({
        id: typeof grp.id === 'string' && grp.id ? grp.id : `group-${Date.now()}-${groupIndex++}`,
        name: groupName,
        shortcuts: validShortcuts,
      });
    }

    if (validGroups.length > 0) {
      return { valid: allValidShortcuts, groups: validGroups };
    }
  }

  // 分支 3: 标准单列表结构 (Array 或 { shortcuts: [...] })
  let rawList: unknown[] = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if ('shortcuts' in parsed && Array.isArray((parsed as Record<string, unknown>).shortcuts)) {
    rawList = (parsed as { shortcuts: unknown[] }).shortcuts;
  } else {
    return { valid: [], error: '未识别到合法的常用网站数据列表' };
  }

  const validShortcuts: Shortcut[] = [];
  let index = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const sanitized = sanitizeShortcutItem(item as Record<string, unknown>, `imported-${index++}`);
    if (sanitized) {
      validShortcuts.push(sanitized);
    }
  }

  if (validShortcuts.length === 0) {
    return { valid: [], error: '文件中未找到有效的网站条目' };
  }

  return { valid: validShortcuts };
}

/**
 * 合并或替换导入的常用网站列表
 */
export function mergeShortcuts(
  imported: Shortcut[],
  current: Shortcut[],
  mode: 'merge' | 'replace' = 'merge'
): Shortcut[] {
  if (mode === 'replace') {
    return imported;
  }

  const existingUrls = new Set<string>();
  const folderMap = new Map<string, Shortcut>();

  for (const s of current) {
    if (s.isFolder) {
      folderMap.set(s.name.trim().toLowerCase(), s);
      if (Array.isArray(s.children)) {
        for (const c of s.children) {
          existingUrls.add(c.url.replace(/\/+$/, '').toLowerCase());
        }
      }
    } else {
      existingUrls.add(s.url.replace(/\/+$/, '').toLowerCase());
    }
  }

  const result: Shortcut[] = [...current];

  for (const item of imported) {
    if (item.isFolder) {
      const folderKey = item.name.trim().toLowerCase();
      if (folderMap.has(folderKey)) {
        // 合并进既有同名文件夹
        const existingFolder = folderMap.get(folderKey)!;
        const currentChildren = existingFolder.children || [];
        existingFolder.children = mergeShortcuts(item.children || [], currentChildren, 'merge');
      } else {
        result.push(item);
        folderMap.set(folderKey, item);
      }
    } else {
      const norm = item.url.replace(/\/+$/, '').toLowerCase();
      if (!existingUrls.has(norm)) {
        existingUrls.add(norm);
        result.push(item);
      }
    }
  }

  return result;
}

/**
 * 合并或替换多分组列表 (T15)
 */
export function mergeGroups(
  importedGroups: ShortcutGroup[],
  currentGroups: ShortcutGroup[],
  mode: 'merge' | 'replace' = 'merge'
): ShortcutGroup[] {
  if (mode === 'replace') {
    return importedGroups;
  }

  const groupMap = new Map<string, ShortcutGroup>();
  for (const g of currentGroups) {
    groupMap.set(g.name.trim().toLowerCase(), { ...g, shortcuts: [...g.shortcuts] });
  }

  for (const imp of importedGroups) {
    const key = imp.name.trim().toLowerCase();
    if (groupMap.has(key)) {
      const existing = groupMap.get(key)!;
      existing.shortcuts = mergeShortcuts(imp.shortcuts, existing.shortcuts, 'merge');
    } else {
      groupMap.set(key, { ...imp });
    }
  }

  return Array.from(groupMap.values());
}
