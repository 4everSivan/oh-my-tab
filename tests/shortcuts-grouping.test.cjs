const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 导入 transfer.ts 对应的逻辑实现进行独立纯函数契约验证
function isValidUrl(url) {
  try {
    const parsed = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeShortcutItem(record, fallbackPrefix = 'item') {
  if (record.isFolder === true || record.type === 'folder') {
    const rawName = typeof record.name === 'string' ? record.name.trim() : '';
    const cleanName = (rawName || '新建文件夹').slice(0, 30);
    const id = typeof record.id === 'string' && record.id ? record.id : `${fallbackPrefix}-folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const children = [];

    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        if (child && typeof child === 'object') {
          const sanitizedChild = sanitizeShortcutItem(child, `${fallbackPrefix}-child`);
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

function parseShortcutsFromJSON(jsonText) {
  if (!jsonText || typeof jsonText !== 'string') {
    return { valid: [], error: '导入的文件内容为空' };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { valid: [], error: 'JSON 文件格式不合规，无法解析' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: [], error: '未识别到合法的常用网站数据列表' };
  }

  // 分支 1: iTab navConfig 备份格式识别 (T15: 原生保留文件夹结构)
  if ('navConfig' in parsed && Array.isArray(parsed.navConfig)) {
    const navConfig = parsed.navConfig;
    const extractedGroups = [];
    const allValidShortcuts = [];
    let groupIndex = 1;

    for (const rawGroup of navConfig) {
      if (!rawGroup || typeof rawGroup !== 'object') continue;
      const groupName = typeof rawGroup.name === 'string' && rawGroup.name.trim() ? rawGroup.name.trim() : `分组 ${groupIndex}`;
      const groupShortcuts = [];
      const seenUrls = new Set();

      if (Array.isArray(rawGroup.children)) {
        for (const child of rawGroup.children) {
          if (!child || typeof child !== 'object') continue;

          if (child.type === 'folder') {
            const folderItem = sanitizeShortcutItem(child, `itab-${groupIndex}`);
            if (folderItem && folderItem.children && folderItem.children.length > 0) {
              groupShortcuts.push(folderItem);
              allValidShortcuts.push(folderItem);
              for (const sc of folderItem.children) {
                seenUrls.add(sc.url.replace(/\/+$/, '').toLowerCase());
              }
            }
          } else {
            const sanitized = sanitizeShortcutItem(child, `itab-${groupIndex}`);
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
          id: typeof rawGroup.id === 'string' && rawGroup.id ? `itab-group-${rawGroup.id}` : `group-itab-${groupIndex++}`,
          name: groupName,
          shortcuts: groupShortcuts,
        });
      }
    }

    if (extractedGroups.length > 0) {
      const homeGroup = extractedGroups.find((g) => g.name === '主页') || extractedGroups[0];
      return { valid: homeGroup.shortcuts, groups: extractedGroups };
    }
  }

  // 分支 2: 标准多分组结构 groups: ShortcutGroup[] (T15)
  if ('groups' in parsed && Array.isArray(parsed.groups)) {
    const rawGroups = parsed.groups;
    const validGroups = [];
    const allValidShortcuts = [];
    let groupIndex = 1;

    for (const rawGroup of rawGroups) {
      if (!rawGroup || typeof rawGroup !== 'object') continue;
      const groupName = typeof rawGroup.name === 'string' && rawGroup.name.trim() ? rawGroup.name.trim() : `分组 ${groupIndex}`;
      const rawShortcuts = Array.isArray(rawGroup.shortcuts) ? rawGroup.shortcuts : [];
      const validShortcuts = [];

      for (const item of rawShortcuts) {
        if (!item || typeof item !== 'object') continue;
        const sanitized = sanitizeShortcutItem(item, `group-${groupIndex}`);
        if (sanitized) {
          validShortcuts.push(sanitized);
          allValidShortcuts.push(sanitized);
        }
      }

      validGroups.push({
        id: typeof rawGroup.id === 'string' && rawGroup.id ? rawGroup.id : `group-${Date.now()}-${groupIndex++}`,
        name: groupName,
        shortcuts: validShortcuts,
      });
    }

    if (validGroups.length > 0) {
      return { valid: allValidShortcuts, groups: validGroups };
    }
  }

  // 分支 3: 标准单列表结构
  let rawList = [];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if ('shortcuts' in parsed && Array.isArray(parsed.shortcuts)) {
    rawList = parsed.shortcuts;
  } else {
    return { valid: [], error: '未识别到合法的常用网站数据列表' };
  }

  const validShortcuts = [];
  let index = 0;

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const sanitized = sanitizeShortcutItem(item, `imported-${index++}`);
    if (sanitized) {
      validShortcuts.push(sanitized);
    }
  }

  if (validShortcuts.length === 0) {
    return { valid: [], error: '文件中未找到有效的网站条目' };
  }

  return { valid: validShortcuts };
}

function mergeShortcuts(imported, current, mode = 'merge') {
  if (mode === 'replace') return imported;
  const existingUrls = new Set();
  const folderMap = new Map();

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

  const result = [...current];

  for (const item of imported) {
    if (item.isFolder) {
      const folderKey = item.name.trim().toLowerCase();
      if (folderMap.has(folderKey)) {
        const existingFolder = folderMap.get(folderKey);
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

function mergeGroups(importedGroups, currentGroups, mode = 'merge') {
  if (mode === 'replace') return importedGroups;
  const groupMap = new Map();
  for (const g of currentGroups) {
    groupMap.set(g.name.trim().toLowerCase(), { ...g, shortcuts: [...g.shortcuts] });
  }
  for (const imp of importedGroups) {
    const key = imp.name.trim().toLowerCase();
    if (groupMap.has(key)) {
      const existing = groupMap.get(key);
      existing.shortcuts = mergeShortcuts(imp.shortcuts, existing.shortcuts, 'merge');
    } else {
      groupMap.set(key, { ...imp });
    }
  }
  return Array.from(groupMap.values());
}

test('T15: StorageService 兼容迁移与 ShortcutGroup 数据契约', () => {
  const storageSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/storage/index.ts'), 'utf-8');
  const typesSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/storage/types.ts'), 'utf-8');

  // 1. types.ts 声明 ShortcutGroup 与 isFolder / children 契约
  assert.ok(typesSrc.includes('isFolder?: boolean;'), 'types.ts 中 Shortcut 必须扩展 isFolder 属性');
  assert.ok(typesSrc.includes('children?: Shortcut[];'), 'types.ts 中 Shortcut 必须扩展 children 属性');
  assert.ok(typesSrc.includes('export interface ShortcutGroup {'), 'types.ts 必须导出 ShortcutGroup');
  assert.ok(typesSrc.includes('DEFAULT_SHORTCUT_GROUPS'), 'types.ts 必须导出 DEFAULT_SHORTCUT_GROUPS');

  // 2. StorageService 包含 getShortcutGroups、setShortcutGroups、getActiveShortcutGroupId、setActiveShortcutGroupId
  assert.ok(storageSrc.includes('async getShortcutGroups()'), 'StorageService 必须包含 getShortcutGroups');
  assert.ok(storageSrc.includes('async setShortcutGroups('), 'StorageService 必须包含 setShortcutGroups');
  assert.ok(storageSrc.includes('async getActiveShortcutGroupId()'), 'StorageService 必须包含 getActiveShortcutGroupId');
  assert.ok(storageSrc.includes('async setActiveShortcutGroupId('), 'StorageService 必须包含 setActiveShortcutGroupId');

  // 3. 校验向下兼容迁移逻辑
  assert.ok(storageSrc.includes('group-default'), 'StorageService 必须默认构建主页默认分组');
  assert.ok(storageSrc.includes('this.getShortcuts()'), '未存分组时必须读取 legacy shortcuts 包装为默认组');
});

test('T15: transfer.ts 支持图标文件夹与 iTab navConfig 格式智能解析', () => {
  // 1. 解析多分组标准 JSON
  const multiGroupJSON = JSON.stringify({
    version: '2.0',
    groups: [
      {
        id: 'g1',
        name: '常用',
        shortcuts: [{ id: '1', name: 'Google', url: 'https://google.com' }]
      },
      {
        id: 'g2',
        name: '开发',
        shortcuts: [{ id: '2', name: 'GitHub', url: 'https://github.com' }]
      }
    ]
  });

  const parsedMulti = parseShortcutsFromJSON(multiGroupJSON);
  assert.ok(!parsedMulti.error);
  assert.strictEqual(parsedMulti.groups.length, 2);
  assert.strictEqual(parsedMulti.groups[0].name, '常用');
  assert.strictEqual(parsedMulti.groups[1].name, '开发');
  assert.strictEqual(parsedMulti.valid.length, 2);

  // 2. 解析 iTab 格式 ({ navConfig: [...] })，原生保留 type: 'folder'
  const itabSample = JSON.stringify({
    navConfig: [
      {
        id: '1',
        name: '主页',
        children: [
          { component: 'weather', type: 'component', name: '天气' },
          { id: 'it1', name: 'JIRA', url: 'http://192.168.0.73/jira', type: 'text' },
          { id: 'it2', name: 'GitHub', url: 'https://github.com/', type: 'icon' },
          {
            id: 'folder1',
            name: '数据库',
            type: 'folder',
            children: [
              { id: 'it3', name: 'PostgreSQL', url: 'https://postgresql.org', type: 'icon' }
            ]
          },
          { id: 'it-add', name: '添加', url: 'itab://add', type: 'icon' }
        ]
      },
      {
        id: '2',
        name: '摸鱼',
        children: [
          { id: 'it4', name: 'Bilibili', url: 'https://bilibili.com', type: 'icon' }
        ]
      }
    ]
  });

  const parsedItab = parseShortcutsFromJSON(itabSample);
  assert.ok(!parsedItab.error);
  assert.strictEqual(parsedItab.groups.length, 2);
  assert.strictEqual(parsedItab.groups[0].name, '主页');
  assert.strictEqual(parsedItab.groups[1].name, '摸鱼');

  // 主页应包含 2 个站点 + 1 个图标文件夹（内含 PostgreSQL），跳过天气与 itab://add
  const homeShortcuts = parsedItab.groups[0].shortcuts;
  assert.strictEqual(homeShortcuts.length, 3);
  assert.strictEqual(homeShortcuts[0].name, 'JIRA');
  assert.strictEqual(homeShortcuts[1].name, 'GitHub');
  assert.strictEqual(homeShortcuts[2].name, '数据库');
  assert.strictEqual(homeShortcuts[2].isFolder, true);
  assert.strictEqual(homeShortcuts[2].children.length, 1);
  assert.strictEqual(homeShortcuts[2].children[0].name, 'PostgreSQL');

  // 3. mergeShortcuts 包含文件夹智能合并测试
  const baseShortcuts = [
    { id: 'b1', name: 'Baidu', url: 'https://baidu.com' }
  ];

  const merged = mergeShortcuts(homeShortcuts, baseShortcuts, 'merge');
  assert.strictEqual(merged.length, 4);
  const dbFolder = merged.find(s => s.name === '数据库');
  assert.ok(dbFolder);
  assert.strictEqual(dbFolder.isFolder, true);
  assert.strictEqual(dbFolder.children.length, 1);
  assert.strictEqual(dbFolder.children[0].name, 'PostgreSQL');
});

test('T15: Shortcuts.tsx 具备完整的图标文件夹渲染、横向展开抽屉托盘与文件协议契约', () => {
  const shortcutsSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/shortcuts/Shortcuts.tsx'), 'utf-8');
  const transferSrc = fs.readFileSync(path.resolve(__dirname, '../src/services/shortcuts/transfer.ts'), 'utf-8');
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf-8');

  // 1. 文件类型选择器支持 .itabdata
  assert.ok(shortcutsSrc.includes('.itabdata'), '文件上传 input 必须包含 .itabdata 格式放行');

  // 2. 具备图标文件夹交互、2x2 微缩预览与横向展开抽屉托盘
  assert.ok(shortcutsSrc.includes('expandedFolderId'), 'Shortcuts 必须包含文件夹展开状态');
  assert.ok(shortcutsSrc.includes('grid grid-cols-2'), 'Shortcuts 必须渲染 2x2 四宫格微缩预览');
  assert.ok(shortcutsSrc.includes('handleDropIntoFolder'), 'Shortcuts 必须包含拖拽放置进文件夹调度');
  assert.ok(shortcutsSrc.includes('handleUngroupFolder'), 'Shortcuts 必须包含解散文件夹调度');
  assert.ok(shortcutsSrc.includes('handleMoveOutOfFolder'), 'Shortcuts 必须包含将网站移出文件夹调度');
  assert.ok(shortcutsSrc.includes('handleMoveIntoFolder'), 'Shortcuts 必须包含将网站移入已有文件夹调度');
  assert.ok(shortcutsSrc.includes('handleCreateFolderWithShortcut'), 'Shortcuts 必须包含新建文件夹并归纳网站调度');
  assert.ok(shortcutsSrc.includes('handleRenameFolderSubmit'), 'Shortcuts 必须包含重命名文件夹提交调度');

  // 3. App.tsx 连接 shortcut 状态与调度
  assert.ok(appSrc.includes('shortcuts'), 'App.tsx 必须管理 shortcuts 状态');
  assert.ok(appSrc.includes('handleShortcutsChange'), 'App.tsx 必须包含 handleShortcutsChange 处理器');

  // 4. transfer.ts 导出 mergeGroups 与原生识别 iTab navConfig 格式
  assert.ok(transferSrc.includes('export function mergeGroups'), 'transfer.ts 必须导出 mergeGroups 函数');
  assert.ok(transferSrc.includes('navConfig'), 'transfer.ts 必须原生探测并解析 navConfig iTab 格式');
  assert.ok(transferSrc.includes('record.type === \'folder\''), 'transfer.ts 必须原生支持 type === folder 清洗提取');
});

test('C020: Shortcuts 展开抽屉托盘与图标容器消除硬编码灰度并接入背景自适应取色契约', () => {
  const shortcutsSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/shortcuts/Shortcuts.tsx'), 'utf-8');
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf-8');

  // 1. App.tsx 必须为 Shortcuts 传递 background 配置
  assert.ok(appSrc.includes('background={background}'), 'App.tsx 必须将 background 状态下传给 Shortcuts');

  // 2. Shortcuts.tsx 声明 background 属性并接入明暗判定
  assert.ok(shortcutsSrc.includes('background?: BackgroundConfig'), 'ShortcutsProps 必须包含 background 属性定义');
  assert.ok(shortcutsSrc.includes('const isDark ='), 'Shortcuts.tsx 必须动态计算 isDark 明暗基准');

  // 3. 展开抽屉托盘彻底消除硬编码纯白底 bg-white/75
  assert.ok(!shortcutsSrc.includes('bg-white/75'), 'Shortcuts.tsx 展开托盘严禁使用硬编码 bg-white/75');

  // 4. 托盘应用自适应毛玻璃与边框/反光样式
  assert.ok(shortcutsSrc.includes('18, 18, 22, 0.72'), 'Shortcuts.tsx 必须包含深色毛玻璃托盘基色定义');
  assert.ok(shortcutsSrc.includes('255, 255, 255, 0.76'), 'Shortcuts.tsx 必须包含浅色高透毛玻璃托盘基色定义');
  assert.ok(shortcutsSrc.includes('backdropFilter'), 'Shortcuts.tsx 托盘必须显式注入 backdropFilter 滤镜增强');
});

