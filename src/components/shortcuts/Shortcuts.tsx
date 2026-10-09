import React, { useState, useRef, useEffect } from 'react';
import { Shortcut } from '../../services/storage/types';
import { Plus, ExternalLink, Edit2, Trash2, Undo2 } from 'lucide-react';

interface ShortcutsProps {
  shortcuts: Shortcut[];
  textColor?: string;
  onChange: (shortcuts: Shortcut[]) => void;
}

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

export const Shortcuts: React.FC<ShortcutsProps> = ({
  shortcuts,
  textColor = '#141c20',
  onChange,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shortcut: Shortcut } | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editError, setEditError] = useState('');
  const [lastRemoved, setLastRemoved] = useState<{ shortcut: Shortcut; index: number } | null>(null);

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);

  // Close context menu on external click
  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handlePointerDown = (index: number) => {
    isDragging.current = false;
    longPressTimer.current = setTimeout(() => {
      setIsLongPressing(true);
      isDragging.current = true;
      setDraggedIndex(index);
    }, 450);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  };

  const handleItemClick = (e: React.MouseEvent, url: string) => {
    if (isDragging.current) {
      e.preventDefault();
      return;
    }
    window.open(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`, '_blank');
  };

  const handleContextMenu = (e: React.MouseEvent, shortcut: Shortcut) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 180),
      y: Math.min(e.clientY, window.innerHeight - 200),
      shortcut,
    });
  };

  const openEditModal = (shortcut: Shortcut) => {
    setEditingShortcut(shortcut);
    setEditName(shortcut.name);
    setEditUrl(shortcut.url);
    setEditError('');
    setIsAdding(false);
  };

  const openAddModal = () => {
    setEditingShortcut({ id: `site-${Date.now()}`, name: '', url: '' });
    setEditName('');
    setEditUrl('');
    setEditError('');
    setIsAdding(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const name = editName.trim();
    const url = editUrl.trim();

    if (!name || name.length > 30) {
      setEditError('网站名称须在 1 到 30 个字符之间');
      return;
    }
    if (!isValidUrl(url)) {
      setEditError('请输入有效的 HTTP(S) 地址');
      return;
    }

    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

    if (isAdding) {
      const newSite: Shortcut = {
        id: `site-${Date.now()}`,
        name,
        url: fullUrl,
      };
      onChange([...shortcuts, newSite]);
    } else if (editingShortcut) {
      const updated = shortcuts.map((s) =>
        s.id === editingShortcut.id ? { ...s, name, url: fullUrl } : s
      );
      onChange(updated);
    }

    setEditingShortcut(null);
  };

  const handleRemove = (shortcut: Shortcut) => {
    const index = shortcuts.findIndex((s) => s.id === shortcut.id);
    if (index !== -1) {
      setLastRemoved({ shortcut, index });
      const next = shortcuts.filter((s) => s.id !== shortcut.id);
      onChange(next);
    }
  };

  const handleUndoRemove = () => {
    if (lastRemoved) {
      const next = [...shortcuts];
      next.splice(lastRemoved.index, 0, lastRemoved.shortcut);
      onChange(next);
      setLastRemoved(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...shortcuts];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);
    setDraggedIndex(index);
    onChange(reordered);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    isDragging.current = false;
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* Shortcuts Grid */}
      <div className="flex flex-wrap items-center justify-center gap-4 max-w-4xl py-4">
        {shortcuts.map((shortcut, index) => {
          const domain = isValidUrl(shortcut.url) ? new URL(shortcut.url.startsWith('http') ? shortcut.url : `https://${shortcut.url}`).hostname : '';
          const faviconUrl = domain ? `https://${domain}/favicon.ico` : '';

          return (
            <div
              key={shortcut.id}
              draggable={isLongPressing}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onPointerDown={() => handlePointerDown(index)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(e) => handleContextMenu(e, shortcut)}
              onClick={(e) => handleItemClick(e, shortcut.url)}
              className="t-stagger-item flex flex-col items-center group cursor-pointer select-none transition-transform duration-150 active:scale-95 w-16"
              style={{ animationDelay: `${index * 35}ms` }}
              title={`${shortcut.name}\n右键查看菜单 / 长按可排序`}
            >
              {/* Icon Container with Squircle Continuous Curve */}
              <div className="relative w-12 h-12 rounded-2xl bg-white/80 dark:bg-stone-800/80 backdrop-blur-md shadow-sm border border-black/5 dark:border-white/10 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
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
                    // 加载成功：恢复 img 并彻底隐藏字母层（防透明图标透出字母）
                    (e.target as HTMLElement).style.display = '';
                    const letter = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                    if (letter) letter.style.visibility = 'hidden';
                  }}
                  className="relative w-6 h-6 object-contain"
                />
              </div>

              {/* Title */}
              <span
                className="mt-1.5 text-[11px] truncate w-full text-center tracking-tight opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ color: textColor }}
              >
                {shortcut.name}
              </span>
            </div>
          );
        })}

        {/* Add Shortcut Button */}
        <button
          type="button"
          onClick={openAddModal}
          className="flex flex-col items-center group cursor-pointer select-none transition-transform duration-150 active:scale-95 w-16"
          title="添加常用网站"
        >
          <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/10 backdrop-blur-md border border-dashed border-stone-300 dark:border-stone-700 flex items-center justify-center transition-all duration-200 group-hover:bg-black/10 dark:group-hover:bg-white/15">
            <Plus className="w-5 h-5 text-stone-500 dark:text-stone-400" />
          </div>
          <span
            className="mt-1.5 text-[11px] truncate w-full text-center tracking-tight opacity-60 group-hover:opacity-100 transition-opacity"
            style={{ color: textColor }}
          >
            添加
          </span>
        </button>
      </div>

      {/* Undo Notification Bar */}
      {lastRemoved && (
        <div className="fixed bottom-6 z-40 flex items-center space-x-3 px-4 py-2 bg-stone-900/90 text-white text-xs rounded-xl shadow-lg backdrop-blur-md t-toast">
          <span>已移除 {lastRemoved.shortcut.name}</span>
          <button
            onClick={handleUndoRemove}
            className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>撤销</span>
          </button>
        </div>
      )}

      {/* Desktop Context Menu */}
      {contextMenu && (
        <div
          className="origin-menu fixed z-50 w-40 py-1 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl border border-black/10 dark:border-white/10 shadow-xl select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <button
            onClick={() => {
              window.open(contextMenu.shortcut.url, '_blank');
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10 flex items-center space-x-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>新标签页打开</span>
          </button>
          <button
            onClick={() => {
              openEditModal(contextMenu.shortcut);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-stone-700 dark:text-stone-300 hover:bg-black/5 dark:hover:bg-white/10 flex items-center space-x-2"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>编辑网站</span>
          </button>
          <div className="my-1 border-t border-black/5 dark:border-white/5" />
          <button
            onClick={() => {
              handleRemove(contextMenu.shortcut);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>移除网站</span>
          </button>
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingShortcut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleSaveModal}
            className="w-full max-w-sm p-6 bg-white dark:bg-stone-900 rounded-2xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-semibold text-stone-800 dark:text-white">
              {isAdding ? '添加常用网站' : '编辑网站'}
            </h3>

            {editError && (
              <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/50 p-2 rounded-lg">
                {editError}
              </p>
            )}

            <div className="space-y-1">
              <label className="text-xs text-stone-500 font-medium">网站名称</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="例如：GitHub"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent text-stone-900 dark:text-white focus:outline-none focus:border-stone-400"
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-stone-500 font-medium">网站网址 (URL)</label>
              <input
                type="text"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-transparent text-stone-900 dark:text-white focus:outline-none focus:border-stone-400"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingShortcut(null)}
                className="px-4 py-2 text-xs rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 font-medium transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 font-medium transition-colors shadow-sm"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
