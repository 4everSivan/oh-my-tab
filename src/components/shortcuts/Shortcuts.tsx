import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Shortcut, ShortcutGroup, BackgroundConfig } from '../../services/storage/types';
import {
  Plus,
  Edit2,
  Trash2,
  Undo2,
  Download,
  Upload,
  Folder,
  FolderPlus,
  FolderOpen,
  FolderMinus,
  X,
  ExternalLink,
  Search,
} from 'lucide-react';
import {
  exportShortcutsToJSON,
  parseShortcutsFromJSON,
  mergeShortcuts,
} from '../../services/shortcuts/transfer';

export { exportShortcutsToJSON as exportShortcuts };

export function getInitial(name: string): string {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!text) return '?';
  const first =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)][0].segment
      : Array.from(text)[0];
  return first.toLocaleUpperCase();
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface LaunchpadProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: Shortcut[];
  groups?: ShortcutGroup[];
  activeGroupId?: string;
  onGroupsChange?: (groups: ShortcutGroup[]) => void;
  onActiveGroupIdChange?: (groupId: string) => void;
  textColor?: string;
  shadowProtection?: string;
  background?: BackgroundConfig;
  onChange?: (shortcuts: Shortcut[]) => void;
}

export interface LaunchpadHandle {
  handleCloseTopLayer: () => boolean;
}

export const Launchpad = React.forwardRef<LaunchpadHandle, LaunchpadProps>(({
  isOpen,
  onClose,
  shortcuts: propShortcuts,
  groups: propGroups,
  activeGroupId: propActiveGroupId,
  onGroupsChange,
  onActiveGroupIdChange: _onActiveGroupIdChange,
  textColor = '#141c20',
  shadowProtection = 'none',
  background,
  onChange,
}, ref) => {
  // 综合背景色与文本色计算明暗基准 (C020: 毛玻璃抽屉背景自适应)
  const isDark =
    textColor.toUpperCase() === '#FFFFFF' ||
    (background?.type === 'material' && background.name === 'dark') ||
    (background?.type === 'color' && (background.shade || 0) > 40);
  // 统合 shortcuts 列表源：优先使用 propShortcuts，兼容 propGroups 第一组
  const shortcuts: Shortcut[] =
    propShortcuts && propShortcuts.length >= 0
      ? propShortcuts
      : propGroups && propGroups.length > 0
      ? propGroups[0].shortcuts
      : [];

  // 启动台名称过滤 (T20)
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredShortcuts = query.trim()
    ? shortcuts.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : shortcuts;

  // 图标文件夹面板状态 (T15)
  const [expandedFolderId, setExpandedFolderId] = useState<string | null>(null);

  // 快捷方式与文件夹增删改状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    shortcut: Shortcut;
    parentFolderId?: string;
  } | null>(null);

  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<'site' | 'folder'>('site');
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState('');

  // 文件夹重命名弹窗
  const [renameFolder, setRenameFolder] = useState<Shortcut | null>(null);
  const [renameFolderName, setRenameFolderName] = useState('');

  // 移除撤销状态
  const [lastRemoved, setLastRemoved] = useState<{
    shortcut: Shortcut;
    index: number;
    parentFolderId?: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 拖拽排序与移入文件夹状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);

  // 当前展开的文件夹对象
  const expandedFolder = expandedFolderId
    ? shortcuts.find((s) => s.id === expandedFolderId && s.isFolder)
    : null;

  // 关闭启动台时收起所有浮层，避免残留状态在下次打开时出现
  useEffect(() => {
    if (isOpen) return;
    setQuery('');
    setExpandedFolderId(null);
    setContextMenu(null);
    setEditingShortcut(null);
    setIsAdding(false);
    setTargetFolderId(null);
    setRenameFolder(null);
    setToastMessage(null);
  }, [isOpen]);

  // 打开后把焦点交给过滤框
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // 全局点击关闭右键菜单
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // 自动隐藏 Toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // 更新常用网站列表并同步广播
  const updateShortcuts = (newShortcuts: Shortcut[]) => {
    if (onChange) {
      onChange(newShortcuts);
    }
    if (onGroupsChange && propGroups && propGroups.length > 0) {
      const activeId = propActiveGroupId || propGroups[0].id;
      const updatedGroups = propGroups.map((g) =>
        g.id === activeId ? { ...g, shortcuts: newShortcuts } : g
      );
      onGroupsChange(updatedGroups);
    }
  };

  // 统一关闭并完全复位模态框状态 (防 N07, N08)
  const handleCloseModal = () => {
    setEditingShortcut(null);
    setIsAdding(false);
    setAddMode('site');
    setTargetFolderId(null);
    setEditError('');
  };

  // 打开添加网站/文件夹弹窗
  const handleOpenAdd = (parentFolder?: string) => {
    setIsAdding(true);
    setAddMode('site');
    setTargetFolderId(parentFolder || null);
    setEditName('');
    setEditUrl('');
    setEditError('');
    setEditingShortcut({ id: '', name: '', url: '' });
  };

  // 打开编辑网站弹窗 (依据目标类型显式校准 addMode，防 N08)
  const handleOpenEdit = (shortcut: Shortcut, parentFolderId?: string) => {
    setIsAdding(false);
    setAddMode(shortcut.isFolder ? 'folder' : 'site');
    setTargetFolderId(parentFolderId || null);
    setEditName(shortcut.name);
    setEditUrl(shortcut.url);
    setEditError('');
    setEditingShortcut(shortcut);
  };

  // 保存新增/编辑弹窗
  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editName.trim();

    if (!cleanName) {
      setEditError(addMode === 'folder' ? '请输入文件夹名称' : '请输入网站名称');
      return;
    }

    if (isAdding && addMode === 'folder') {
      // 创建新图标文件夹 (T15)
      const newFolder: Shortcut = {
        id: `folder-${Date.now()}`,
        name: cleanName.slice(0, 30),
        url: '',
        isFolder: true,
        children: [],
      };
      updateShortcuts([...shortcuts, newFolder]);
      handleCloseModal();
      setToastMessage(`已新建文件夹「${newFolder.name}」`);
      return;
    }

    // 网站模式：必须校验合法 URL
    const cleanUrl = editUrl.trim();
    if (!cleanUrl) {
      setEditError('请输入网站地址');
      return;
    }
    if (!isValidUrl(cleanUrl)) {
      setEditError('请输入合法的网址（必须以 http:// 或 https:// 开头）');
      return;
    }

    const fullUrl =
      cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')
        ? cleanUrl
        : `https://${cleanUrl}`;

    if (isAdding) {
      const newShortcut: Shortcut = {
        id: `shortcut-${Date.now()}`,
        name: cleanName.slice(0, 30),
        url: fullUrl,
      };

      if (targetFolderId) {
        // 添加到指定文件夹内部 (T15)
        const updated = shortcuts.map((s) => {
          if (s.id === targetFolderId && s.isFolder) {
            return {
              ...s,
              children: [...(s.children || []), newShortcut],
            };
          }
          return s;
        });
        updateShortcuts(updated);
        setToastMessage(`已将「${newShortcut.name}」添加至文件夹`);
      } else {
        // 添加到主列表
        updateShortcuts([...shortcuts, newShortcut]);
        setToastMessage(`已添加网站「${newShortcut.name}」`);
      }
    } else if (editingShortcut) {
      if (targetFolderId) {
        // 编辑文件夹内子站点
        const updated = shortcuts.map((s) => {
          if (s.id === targetFolderId && s.isFolder) {
            return {
              ...s,
              children: (s.children || []).map((child) =>
                child.id === editingShortcut.id
                  ? { ...child, name: cleanName.slice(0, 30), url: fullUrl }
                  : child
              ),
            };
          }
          return s;
        });
        updateShortcuts(updated);
      } else {
        // 编辑主列表项目
        const updated = shortcuts.map((item) =>
          item.id === editingShortcut.id
            ? { ...item, name: cleanName.slice(0, 30), url: fullUrl }
            : item
        );
        updateShortcuts(updated);
      }
    }

    handleCloseModal();
  };

  // 移除网站或文件夹
  const handleRemove = (shortcut: Shortcut, parentFolderId?: string) => {
    if (parentFolderId) {
      // 移除文件夹内的子项
      const parentFolder = shortcuts.find((s) => s.id === parentFolderId);
      if (!parentFolder || !parentFolder.children) return;
      const index = parentFolder.children.findIndex((c) => c.id === shortcut.id);
      if (index === -1) return;

      setLastRemoved({ shortcut, index, parentFolderId });
      const updated = shortcuts.map((s) => {
        if (s.id === parentFolderId) {
          return {
            ...s,
            children: (s.children || []).filter((c) => c.id !== shortcut.id),
          };
        }
        return s;
      });
      updateShortcuts(updated);
      setToastMessage(`已从文件夹中移除「${shortcut.name}」`);
    } else {
      // 移除根层级项目（网站或文件夹）
      const index = shortcuts.findIndex((s) => s.id === shortcut.id);
      if (index === -1) return;

      setLastRemoved({ shortcut, index });
      const updated = shortcuts.filter((s) => s.id !== shortcut.id);
      if (expandedFolderId === shortcut.id) {
        setExpandedFolderId(null);
      }
      updateShortcuts(updated);
      setToastMessage(`已移除「${shortcut.name}」`);
    }
  };

  // 撤销删除
  const handleUndo = () => {
    if (!lastRemoved) return;
    const { shortcut, index, parentFolderId } = lastRemoved;

    if (parentFolderId) {
      const updated = shortcuts.map((s) => {
        if (s.id === parentFolderId && s.isFolder) {
          const nextChildren = [...(s.children || [])];
          nextChildren.splice(index, 0, shortcut);
          return { ...s, children: nextChildren };
        }
        return s;
      });
      updateShortcuts(updated);
    } else {
      const updated = [...shortcuts];
      updated.splice(index, 0, shortcut);
      updateShortcuts(updated);
    }

    setLastRemoved(null);
  };

  // 解散文件夹：将所有子站点释放回主列表，并物理移除文件夹 (T15)
  const handleUngroupFolder = (folder: Shortcut) => {
    const folderIndex = shortcuts.findIndex((s) => s.id === folder.id);
    if (folderIndex === -1) return;

    const children = folder.children || [];
    const updated = [...shortcuts];
    // 移除文件夹，并在原位插入所有子站点
    updated.splice(folderIndex, 1, ...children);

    if (expandedFolderId === folder.id) {
      setExpandedFolderId(null);
    }
    updateShortcuts(updated);
    setToastMessage(`已解散文件夹「${folder.name}」，${children.length} 个网站已移回首页`);
  };

  // 将网站移出文件夹至主列表 (T15)
  const handleMoveOutOfFolder = (child: Shortcut, parentFolderId: string) => {
    const parentFolder = shortcuts.find((s) => s.id === parentFolderId);
    if (!parentFolder) return;

    const updated = shortcuts.map((s) => {
      if (s.id === parentFolderId) {
        return {
          ...s,
          children: (s.children || []).filter((c) => c.id !== child.id),
        };
      }
      return s;
    });

    // 移入主列表根层级
    updated.push(child);
    updateShortcuts(updated);
    setToastMessage(`已将「${child.name}」移出文件夹至首页`);
  };

  // 将网站移入已有文件夹 (T15)
  const handleMoveIntoFolder = (shortcut: Shortcut, targetFolder: Shortcut) => {
    const updated = shortcuts
      .filter((s) => s.id !== shortcut.id)
      .map((s) => {
        if (s.id === targetFolder.id) {
          return {
            ...s,
            children: [...(s.children || []), shortcut],
          };
        }
        return s;
      });

    updateShortcuts(updated);
    setToastMessage(`已将「${shortcut.name}」移入「${targetFolder.name}」`);
  };

  // 新建文件夹并移入网站 (T15)
  const handleCreateFolderWithShortcut = (shortcut: Shortcut) => {
    const folderName = `${shortcut.name} 组`;
    const newFolder: Shortcut = {
      id: `folder-${Date.now()}`,
      name: folderName.slice(0, 20),
      url: '',
      isFolder: true,
      children: [shortcut],
    };

    const updated = shortcuts.filter((s) => s.id !== shortcut.id);
    updated.push(newFolder);
    updateShortcuts(updated);
    setToastMessage(`已创建文件夹「${newFolder.name}」并归纳该网站`);
  };

  // 重命名文件夹提交 (T15)
  const handleRenameFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFolder) return;
    const clean = renameFolderName.trim();
    if (!clean) return;

    const updated = shortcuts.map((s) =>
      s.id === renameFolder.id ? { ...s, name: clean.slice(0, 30) } : s
    );
    updateShortcuts(updated);
    setRenameFolder(null);
    setRenameFolderName('');
    setToastMessage(`已重命名文件夹为「${clean}」`);
  };

  // 指针长按与拖拽
  const handlePointerDown = (index: number) => {
    isDragging.current = false;
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      setDraggedIndex(index);
      isDragging.current = true;
    }, 450);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setTimeout(() => {
      setIsLongPressing(false);
    }, 100);
  };

  // 网站点击导航
  const handleItemClick = (e: React.MouseEvent, url: string) => {
    if (isDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    window.location.href = url;
  };

  // 右键菜单唤起
  const handleContextMenu = (e: React.MouseEvent, shortcut: Shortcut, parentFolderId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, shortcut, parentFolderId });
  };

  // 拖拽开始与排序
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updated = [...shortcuts];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setDraggedIndex(targetIndex);
    updateShortcuts(updated);
  };

  // 拖拽放入文件夹目标 (T15)
  const handleDropIntoFolder = (e: React.DragEvent, targetFolder: Shortcut) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    if (draggedIndex === null) return;
    const draggedItem = shortcuts[draggedIndex];
    if (!draggedItem || draggedItem.id === targetFolder.id || draggedItem.isFolder) {
      return;
    }

    handleMoveIntoFolder(draggedItem, targetFolder);
    setDraggedIndex(null);
    isDragging.current = false;
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverFolderId(null);
    isDragging.current = false;
  };

  // 导出与导入 (T14, T15 & C025)
  const handleExport = () => {
    if (propGroups && propGroups.length > 0) {
      exportShortcutsToJSON({ groups: propGroups, activeShortcuts: shortcuts });
      setToastMessage(`已导出 ${propGroups.length} 个分组全部常用网站与文件夹配置 (JSON)`);
    } else {
      exportShortcutsToJSON(shortcuts);
      setToastMessage(`已导出 ${shortcuts.length} 个常用网站与文件夹配置 (JSON)`);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const { valid, groups: importedGroups, error } = parseShortcutsFromJSON(text);
        if (error) {
          setEditError(error);
          return;
        }

        if (importedGroups && importedGroups.length > 0 && onGroupsChange) {
          // iTab 或多分组配置全量导入闭环 (N02)
          onGroupsChange(importedGroups);
          const totalCount = importedGroups.reduce((acc, g) => acc + g.shortcuts.length, 0);
          setToastMessage(`成功导入 ${importedGroups.length} 个分组共 ${totalCount} 项网站与文件夹`);
        } else {
          const updated = mergeShortcuts(valid, shortcuts, 'merge');
          updateShortcuts(updated);
          setToastMessage(`成功导入 ${valid.length} 项网站与文件夹`);
        }
        handleCloseModal();
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 供 App 的 Escape 级联关闭：优先关闭启动台内部的弹窗/菜单/文件夹，再关闭启动台本身
  const handleLaunchpadTopLayer = () => {
    if (contextMenu) {
      setContextMenu(null);
      return true;
    }
    if (editingShortcut || isAdding) {
      handleCloseModal();
      return true;
    }
    if (renameFolder) {
      setRenameFolder(null);
      setRenameFolderName('');
      return true;
    }
    if (expandedFolderId) {
      setExpandedFolderId(null);
      return true;
    }
    return false;
  };

  useImperativeHandle(ref, () => ({ handleCloseTopLayer: handleLaunchpadTopLayer }));

  // 所有既有文件夹列表（用于右键快速归类移入）
  const existingFolders = shortcuts.filter((s) => s.isFolder);

  return (
    <div
      data-open={isOpen ? 'true' : 'false'}
      aria-hidden={!isOpen}
      className="launchpad-overlay fixed inset-0 z-40 flex flex-col select-none"
    >
      <div
        className="launchpad-backdrop absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="launchpad-shell relative z-10 flex h-full w-full flex-col px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60"
            style={{ color: textColor }}
          >
            启动台
          </span>
          <label
            className="flex h-10 w-full max-w-[360px] items-center gap-2 rounded-full border px-4 backdrop-blur-xl"
            style={{
              backgroundColor: isDark ? 'rgba(20, 20, 24, 0.55)' : 'rgba(255, 255, 255, 0.82)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.07)',
              color: textColor,
            }}
          >
            <Search className="h-4 w-4 flex-shrink-0 opacity-50" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索网站…"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:opacity-50"
              style={{ color: textColor }}
              aria-label="搜索网站"
            />
          </label>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.82)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.07)',
              color: textColor,
            }}
            aria-label="关闭启动台"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-x-3 gap-y-7 py-10 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {filteredShortcuts.map((shortcut, localIndex) => {
          const globalIndex = shortcuts.findIndex((s) => s.id === shortcut.id);
          const isFolder = !!shortcut.isFolder;
          const isExpanded = isFolder && expandedFolderId === shortcut.id;
          const isDragTarget = isFolder && dragOverFolderId === shortcut.id;

          if (isFolder) {
            // 图标文件夹渲染 (T15: 2x2 微缩预览网格，至多展示 4 个子图标)
            const children = shortcut.children || [];
            return (
              <div
                key={shortcut.id}
                draggable={isLongPressing}
                onDragStart={(e) => handleDragStart(e, globalIndex)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverFolderId(shortcut.id);
                  handleDragOver(e, globalIndex);
                }}
                onDragLeave={() => {
                  if (dragOverFolderId === shortcut.id) setDragOverFolderId(null);
                }}
                onDrop={(e) => handleDropIntoFolder(e, shortcut)}
                onDragEnd={handleDragEnd}
                onPointerDown={() => handlePointerDown(globalIndex)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(e) => handleContextMenu(e, shortcut)}
                onClick={(e) => {
                  if (isDragging.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  setExpandedFolderId((prev) => (prev === shortcut.id ? null : shortcut.id));
                }}
                className={`t-stagger-item flex flex-col items-center group cursor-pointer select-none transition-transform duration-150 active:scale-95 w-full relative ${
                  isExpanded ? 'scale-105' : ''
                }`}
                style={{ animationDelay: `${localIndex * 35}ms` }}
                title={`文件夹「${shortcut.name}」(${children.length} 个网站)\n点击横向展开 / 右键管理`}
              >
                {/* 文件夹连续圆角容器 (2x2 四宫格微缩预览，自适应明暗背景) */}
                <div
                  className={`shortcut-icon-container liquid-glass-surface relative w-[68px] h-[68px] rounded-[20px] backdrop-blur-md shadow-sm border flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-105 ${
                    isDragTarget
                      ? 'ring-2 ring-blue-500 scale-110 border-blue-500'
                      : isExpanded
                      ? 'ring-2 ring-stone-400 dark:ring-stone-500 shadow-md'
                      : ''
                  }`}
                  style={{
                    backgroundColor: isDark
                      ? isExpanded
                        ? 'rgba(255, 255, 255, 0.22)'
                        : 'rgba(255, 255, 255, 0.12)'
                      : isExpanded
                      ? 'rgba(255, 255, 255, 0.95)'
                      : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isDark
                      ? isExpanded
                        ? 'rgba(255, 255, 255, 0.35)'
                        : 'rgba(255, 255, 255, 0.18)'
                      : isExpanded
                      ? 'rgba(0, 0, 0, 0.15)'
                      : 'rgba(0, 0, 0, 0.06)',
                  }}
                >
                  {children.length > 0 ? (
                    <div className="grid grid-cols-2 gap-0.5 p-1 w-full h-full pointer-events-none">
                      {children.slice(0, 4).map((child, cIdx) => {
                        const childDomain = isValidUrl(child.url)
                          ? new URL(child.url.startsWith('http') ? child.url : `https://${child.url}`).hostname
                          : '';
                        const childFavicon = childDomain ? `https://${childDomain}/favicon.ico` : '';

                        return (
                          <div
                            key={child.id || cIdx}
                            className="relative w-full h-full rounded-md flex items-center justify-center overflow-hidden"
                            style={{
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.14)'
                                : 'rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            <span
                              className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase select-none"
                              style={{
                                color: isDark ? '#FFFFFF' : '#333333',
                              }}
                            >
                              {getInitial(child.name)}
                            </span>
                            <img
                              src={childFavicon}
                              alt=""
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                                const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                                if (letter) letter.style.visibility = 'visible';
                              }}
                              onLoad={(e) => {
                                (e.target as HTMLElement).style.display = '';
                                const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                                if (letter) letter.style.visibility = 'hidden';
                              }}
                              className="w-3.5 h-3.5 object-contain z-10"
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Folder className="w-5 h-5 opacity-40" style={{ color: textColor }} />
                  )}
                </div>


                {/* 文件夹名称 */}
                <span
                  className="mt-2 text-xs font-medium truncate max-w-[64px] text-center transition-colors drop-shadow-xs flex items-center gap-0.5"
                  style={{
                    color: textColor,
                    textShadow: shadowProtection !== 'none' ? shadowProtection : undefined,
                  }}
                >
                  {shortcut.name}
                </span>
              </div>
            );
          }

          // 普通常用网站渲染
          const domain = isValidUrl(shortcut.url)
            ? new URL(shortcut.url.startsWith('http') ? shortcut.url : `https://${shortcut.url}`).hostname
            : '';
          const faviconUrl = domain ? `https://${domain}/favicon.ico` : '';

          return (
            <div
              key={shortcut.id}
              draggable={isLongPressing}
              onDragStart={(e) => handleDragStart(e, globalIndex)}
              onDragOver={(e) => handleDragOver(e, globalIndex)}
              onDragEnd={handleDragEnd}
              onPointerDown={() => handlePointerDown(globalIndex)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => handleContextMenu(e, shortcut)}
              onClick={(e) => handleItemClick(e, shortcut.url)}
              className="t-stagger-item flex flex-col items-center group cursor-pointer select-none transition-transform duration-150 active:scale-95 w-full relative"
              style={{ animationDelay: `${localIndex * 35}ms` }}
              title={`${shortcut.name}\n右键查看菜单 / 长按可排序`}
            >
              {/* Icon Container with Squircle Continuous Curve */}
              <div className="shortcut-icon-container liquid-glass-surface relative w-[68px] h-[68px] rounded-[20px] bg-white/80 dark:bg-stone-800/80 backdrop-blur-md shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
                {/* 首字母是图标缺失时的独占兜底层（C005）：垫在容器底部，
                    图标 img 加载成功后覆盖其上；onError 隐藏 img 才露出字母 */}
                <span className="absolute inset-0 flex items-center justify-center text-base font-semibold text-stone-700 dark:text-stone-200 uppercase select-none">
                  {getInitial(shortcut.name)}
                </span>
                <img
                  src={faviconUrl}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // 图标不可用：隐藏 img 露出底层首字母（字母唯一展示场景）
                    (e.target as HTMLElement).style.display = 'none';
                    const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                    if (letter) letter.style.visibility = 'visible';
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLElement).style.display = '';
                    const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                    if (letter) letter.style.visibility = 'hidden';
                  }}
                  className="w-9 h-9 object-contain z-10 transition-transform duration-200 group-hover:scale-110"
                />
              </div>


              {/* Title */}
              <span
                className="mt-2 text-xs font-medium truncate max-w-[64px] text-center transition-colors drop-shadow-xs"
                style={{
                  color: textColor,
                  textShadow: shadowProtection !== 'none' ? shadowProtection : undefined,
                }}
              >
                {shortcut.name}
              </span>
            </div>
          );
        })}

        {/* Add Shortcut Button (C008: 接入 t-stagger-item 与尾随延迟) */}
        <button
            onClick={() => handleOpenAdd()}
            className="t-stagger-item flex flex-col items-center group cursor-pointer select-none transition-transform duration-150 active:scale-95 w-full"
            style={{ animationDelay: `${shortcuts.length * 35}ms` }}
            title="添加常用网站或文件夹"
          >
            <div className="w-[68px] h-[68px] rounded-[20px] bg-black/5 dark:bg-white/5 backdrop-blur-md border border-dashed border-black/20 dark:border-white/20 flex items-center justify-center transition-colors duration-200 group-hover:bg-black/10 dark:group-hover:bg-white/10 group-hover:scale-105">
              <Plus className="w-5 h-5 opacity-60 group-hover:opacity-100 transition-opacity" style={{ color: textColor }} />
            </div>
            <span
              className="mt-2 text-xs font-medium opacity-60 group-hover:opacity-100 transition-opacity truncate max-w-[64px] text-center"
              style={{ color: textColor }}
            >
              添加
            </span>
        </button>
          </div>

          {filteredShortcuts.length === 0 && query.trim() && (
            <div
              className="mx-auto max-w-6xl py-6 text-center text-xs"
              style={{ color: textColor, opacity: 0.55 }}
            >
              没有找到匹配的网站
            </div>
          )}

          {/* 图标文件夹横向展开抽屉托盘 (T15 & C020: Horizontal Expansion Tray 背景自适应) */}
      {expandedFolder && (
        <div
          className="w-full max-w-2xl mx-auto my-2 px-4 py-3 rounded-2xl shadow-xl animate-fade-in select-none"
          style={{
            backgroundColor: isDark
              ? 'rgba(18, 18, 22, 0.72)'
              : 'rgba(255, 255, 255, 0.76)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: `1px solid ${
              isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)'
            }`,
            boxShadow: isDark
              ? '0 16px 40px -8px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1) inset'
              : '0 16px 40px -8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(255, 255, 255, 0.7) inset',
          }}
        >
          {/* 托盘顶部标题栏与快捷操作 */}
          <div
            className="flex items-center justify-between pb-2 mb-2 border-b"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
            }}
          >
            <div className="flex items-center gap-2">
              <FolderOpen
                className="w-4 h-4"
                style={{
                  color: textColor,
                  opacity: isDark ? 0.9 : 0.75,
                }}
              />
              <span
                className="text-xs font-semibold"
                style={{
                  color: textColor,
                  textShadow: shadowProtection !== 'none' ? shadowProtection : undefined,
                }}
              >
                {expandedFolder.name}
              </span>
              <span
                className="text-[10px] font-mono"
                style={{
                  color: textColor,
                  opacity: 0.55,
                }}
              >
                ({expandedFolder.children?.length || 0} 个网站)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenAdd(expandedFolder.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer hover:scale-102"
                style={{
                  color: textColor,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.05)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.08)'}`,
                }}
                title="在当前文件夹内添加网站"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加网站</span>
              </button>
              <button
                type="button"
                onClick={() => setExpandedFolderId(null)}
                className="p-1 rounded-lg transition-colors cursor-pointer"
                style={{
                  color: textColor,
                  opacity: 0.65,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = isDark
                    ? 'rgba(255, 255, 255, 0.14)'
                    : 'rgba(0, 0, 0, 0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.65';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="收起文件夹 (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 托盘内部横向紧凑滚动排布子网站 */}
          <div className="flex items-center gap-3.5 overflow-x-auto py-2 px-1 scrollbar-none min-h-[76px]">
            {expandedFolder.children && expandedFolder.children.length > 0 ? (
              expandedFolder.children.map((child, cIdx) => {
                const childDomain = isValidUrl(child.url)
                  ? new URL(child.url.startsWith('http') ? child.url : `https://${child.url}`).hostname
                  : '';
                const childFavicon = childDomain ? `https://${childDomain}/favicon.ico` : '';

                return (
                  <div
                    key={child.id || cIdx}
                    onClick={(e) => handleItemClick(e, child.url)}
                    onContextMenu={(e) => handleContextMenu(e, child, expandedFolder.id)}
                    className="flex flex-col items-center group/sub cursor-pointer select-none transition-transform duration-150 active:scale-95 w-14 flex-shrink-0"
                    title={`${child.name}\n${child.url}\n右键查看菜单`}
                  >
                    <div
                      className="relative w-11 h-11 rounded-2xl backdrop-blur-md shadow-xs flex items-center justify-center overflow-hidden transition-all duration-200 group-hover/sub:shadow-md group-hover/sub:scale-105"
                      style={{
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.85)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.06)'}`,
                      }}
                    >
                      <span
                        className="absolute inset-0 flex items-center justify-center text-sm font-semibold uppercase select-none"
                        style={{
                          color: isDark ? '#FFFFFF' : '#333333',
                        }}
                      >
                        {getInitial(child.name)}
                      </span>
                      <img
                        src={childFavicon}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                          const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                          if (letter) letter.style.visibility = 'visible';
                        }}
                        onLoad={(e) => {
                          (e.target as HTMLElement).style.display = '';
                          const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                          if (letter) letter.style.visibility = 'hidden';
                        }}
                        className="w-6 h-6 object-contain z-10 transition-transform duration-200 group-hover/sub:scale-110"
                      />
                    </div>
                    <span
                      className="mt-1.5 text-[11px] font-medium truncate max-w-[56px] text-center transition-colors drop-shadow-xs"
                      style={{
                        color: textColor,
                        textShadow: shadowProtection !== 'none' ? shadowProtection : undefined,
                      }}
                    >
                      {child.name}
                    </span>
                  </div>
                );
              })
            ) : (
              <div
                className="w-full py-2 text-center text-xs font-medium"
                style={{
                  color: textColor,
                  opacity: 0.55,
                }}
              >
                当前文件夹为空，可将主页图标拖入或点击右侧添加网站
              </div>
            )}

            {/* 托盘内添加网站按钮 */}
            <button
              type="button"
              onClick={() => handleOpenAdd(expandedFolder.id)}
              className="flex flex-col items-center group/add cursor-pointer select-none transition-transform duration-150 active:scale-95 w-14 flex-shrink-0"
              title="在当前文件夹内添加网站"
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors duration-200 group-hover/add:scale-105"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                  border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.15)'}`,
                }}
              >
                <Plus
                  className="w-4 h-4 opacity-60 group-hover/add:opacity-100 transition-opacity"
                  style={{ color: textColor }}
                />
              </div>
              <span
                className="mt-1.5 text-[11px] font-medium opacity-60 group-hover/add:opacity-100 transition-opacity truncate max-w-[56px] text-center"
                style={{
                  color: textColor,
                  textShadow: shadowProtection !== 'none' ? shadowProtection : undefined,
                }}
              >
                添加
              </span>
            </button>
          </div>
        </div>
      )}

        </div>
        <div
          className="relative z-10 flex items-center justify-between gap-3 px-2 pt-2 text-[10.5px]"
          style={{ color: textColor }}
        >
          <span className="opacity-50">右键管理 · 拖拽排序 · 支持文件夹</span>
          <span className="opacity-50">点击空白处或按 Esc 退出</span>
        </div>
      </div>

      {/* 撤销删除 Toast */}
      {lastRemoved && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center space-x-3 px-4 py-2.5 bg-stone-900/95 dark:bg-stone-100/95 text-white dark:text-stone-900 text-xs rounded-2xl shadow-xl backdrop-blur-md animate-fade-in select-none">
          <span>已移除「{lastRemoved.shortcut.name}」</span>
          <button
            onClick={handleUndo}
            className="flex items-center space-x-1 font-semibold text-amber-400 dark:text-amber-600 hover:underline cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>撤销</span>
          </button>
        </div>
      )}

      {/* 快捷方式 / 文件夹右键桌面式上下文菜单 */}
      {contextMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
            className="origin-menu fixed z-50 min-w-[150px] p-1 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl border border-black/10 dark:border-white/10 shadow-xl text-stone-800 dark:text-stone-200 select-none animate-fade-in"
          >
            {contextMenu.shortcut.isFolder ? (
              // 针对文件夹的右键操作 (T15)
              <>
                <button
                  onClick={() => {
                    setRenameFolder(contextMenu.shortcut);
                    setRenameFolderName(contextMenu.shortcut.name);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 opacity-60" />
                  <span>重命名文件夹</span>
                </button>
                <button
                  onClick={() => {
                    handleUngroupFolder(contextMenu.shortcut);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <FolderMinus className="w-3.5 h-3.5 opacity-60" />
                  <span>解散文件夹</span>
                </button>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={() => {
                    handleRemove(contextMenu.shortcut);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除文件夹</span>
                </button>
              </>
            ) : contextMenu.parentFolderId ? (
              // 针对文件夹内子站点的右键操作 (T15)
              <>
                <button
                  onClick={() => {
                    handleOpenEdit(contextMenu.shortcut, contextMenu.parentFolderId);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 opacity-60" />
                  <span>编辑网站</span>
                </button>
                <button
                  onClick={() => {
                    if (contextMenu.parentFolderId) {
                      handleMoveOutOfFolder(contextMenu.shortcut, contextMenu.parentFolderId);
                    }
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  <span>移出文件夹</span>
                </button>
                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={() => {
                    handleRemove(contextMenu.shortcut, contextMenu.parentFolderId);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>移除网站</span>
                </button>
              </>
            ) : (
              // 针对普通主列表网站的右键操作
              <>
                <button
                  onClick={() => {
                    handleOpenEdit(contextMenu.shortcut);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 opacity-60" />
                  <span>编辑网站</span>
                </button>

                {/* 移入既有文件夹选项 (T15) */}
                {existingFolders.length > 0 && (
                  <>
                    <div className="my-1 border-t border-black/5 dark:border-white/5" />
                    <div className="px-3 py-1 text-[10px] font-semibold text-stone-400">
                      移入文件夹:
                    </div>
                    {existingFolders.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          handleMoveIntoFolder(contextMenu.shortcut, f);
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1 text-left text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center justify-between cursor-pointer"
                      >
                        <span className="truncate">{f.name}</span>
                        <span className="text-[10px] opacity-50">({f.children?.length || 0})</span>
                      </button>
                    ))}
                  </>
                )}

                <button
                  onClick={() => {
                    handleCreateFolderWithShortcut(contextMenu.shortcut);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5 opacity-60" />
                  <span>新建文件夹并移入</span>
                </button>

                <div className="my-1 border-t border-black/5 dark:border-white/5" />
                <button
                  onClick={() => {
                    handleRemove(contextMenu.shortcut);
                    setContextMenu(null);
                  }}
                  className="w-full px-3 py-1.5 text-left text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg flex items-center space-x-2 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>移除网站</span>
                </button>
              </>
            )}
          </div>,
          document.body
        )}

      {/* 文件夹重命名弹窗 (T15) */}
      {renameFolder &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setRenameFolder(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
          >
            <form
              onSubmit={handleRenameFolderSubmit}
              className="w-full max-w-xs p-5 bg-white dark:bg-stone-900 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
            >
              <h3 className="text-sm font-semibold text-stone-800 dark:text-white flex items-center gap-1.5">
                <Folder className="w-4 h-4 opacity-70" />
                <span>重命名文件夹</span>
              </h3>
              <input
                type="text"
                autoFocus
                maxLength={30}
                value={renameFolderName}
                onChange={(e) => setRenameFolderName(e.target.value)}
                placeholder="文件夹名称"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent text-stone-900 dark:text-white focus:outline-none focus:border-stone-400"
              />
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameFolder(null)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 font-medium transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium transition-colors shadow-sm cursor-pointer"
                >
                  确定
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

      {/* 隐藏的文件导入 input：支持 .json 与 .itabdata (T14 & T15) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.itabdata,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 导入 / 导出等全局通知 Toast (T14 & T15) */}
      {toastMessage &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-stone-900/90 dark:bg-stone-100/90 text-white dark:text-stone-900 text-xs rounded-xl shadow-lg backdrop-blur-md t-toast select-none">
            {toastMessage}
          </div>,
          document.body
        )}

      {/* Edit / Add Modal */}
      {editingShortcut &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseModal();
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
          >
            <form
              onSubmit={handleSaveModal}
              className="w-full max-w-sm p-6 bg-white dark:bg-stone-900 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-800 dark:text-white">
                  {isAdding
                    ? targetFolderId
                      ? `在「${shortcuts.find((s) => s.id === targetFolderId)?.name || '文件夹'}」中添加网站`
                      : '添加项目'
                    : '编辑网站'}
                </h3>

                {/* 新增模式切换：网站 vs 文件夹 (仅在主列表添加时可选) */}
                {isAdding && !targetFolderId && (
                  <div className="flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setAddMode('site')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        addMode === 'site'
                          ? 'bg-white dark:bg-stone-700 font-semibold shadow-2xs text-stone-900 dark:text-white'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      网站
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode('folder')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        addMode === 'folder'
                          ? 'bg-white dark:bg-stone-700 font-semibold shadow-2xs text-stone-900 dark:text-white'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                    >
                      文件夹
                    </button>
                  </div>
                )}
              </div>

              {editError && (
                <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg">
                  {editError}
                </p>
              )}

              <div className="space-y-1">
                <label className="text-xs text-stone-500 font-medium">
                  {addMode === 'folder' ? '文件夹名称' : '网站名称'}
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={addMode === 'folder' ? '例如：开发工具 / 常用数据库' : '例如：GitHub'}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent text-stone-900 dark:text-white focus:outline-none focus:border-stone-400"
                />
              </div>

              {addMode === 'site' && (
                <div className="space-y-1">
                  <label className="text-xs text-stone-500 font-medium">网站地址</label>
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent text-stone-900 dark:text-white focus:outline-none focus:border-stone-400"
                  />
                </div>
              )}

              {/* 底部操作区：左侧导入导出 (T14 & T15)，右侧取消与保存 */}
              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleImportClick}
                    className="flex items-center space-x-1 px-2.5 py-1.5 text-xs rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer"
                    title="从 JSON / iTab 文件导入网站与文件夹"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>导入</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="flex items-center space-x-1 px-2.5 py-1.5 text-xs rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium transition-colors cursor-pointer"
                    title="导出当前网站与文件夹配置 (JSON)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>导出</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleCloseModal()}
                    className="px-4 py-2 text-xs rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 font-medium transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium transition-colors shadow-sm cursor-pointer"
                  >
                    保存
                  </button>
                </div>
              </div>
            </form>
          </div>,
          document.body
        )}
    </div>
  );
});
