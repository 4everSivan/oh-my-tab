import { useEffect, useCallback } from 'react';

export interface UseKeyboardShortcutsOptions {
  /** 聚焦搜索框回调 */
  onFocusSearch?: () => void;
  /** 切换搜索引擎回调 */
  onCycleEngine?: (direction: 'next' | 'prev') => void;
  /** 级联关闭顶层浮层回调（返回 true 表示已消费） */
  onCloseTopLayer?: () => boolean;
  /** 打开/关闭快捷键帮助回调 */
  onToggleHelp?: () => void;
  /** 打开/关闭外观抽屉回调 */
  onToggleDrawer?: () => void;
  /** 打开/关闭订阅消息侧边栏回调 (T17) */
  onToggleFeedSidebar?: () => void;
  /** 打开/关闭添加组件弹窗回调 */
  onToggleAddModal?: () => void;
  /** 切换折叠极简模式回调 */
  onToggleCollapse?: () => void;
  /** 搜索输入框 DOM 引用 */
  searchInputRef?: React.RefObject<HTMLInputElement>;
}

/**
 * 判断指定元素是否属于输入编辑元素（input, textarea, select, contentEditable）
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  return target.isContentEditable;
}

/**
 * 全局快捷键调度 Hook (T12)
 * 支持：
 * - ` (反引号): 快速对焦主页搜索框
 * - Tab / Shift+Tab: 循环切换搜索引擎
 * - Escape: 级联退出顶层抽屉/弹窗/搜索框焦点
 * - ?: 唤起快捷键全景指南
 * - e / s: 打开/关闭外观设置
 * - a: 打开/关闭添加组件弹窗
 * - c: 切换极简折叠模式
 */
export function useKeyboardShortcuts({
  onFocusSearch,
  onCycleEngine,
  onCloseTopLayer,
  onToggleHelp,
  onToggleDrawer,
  onToggleFeedSidebar,
  onToggleAddModal,
  onToggleCollapse,
  searchInputRef,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isSearchFocused = !!(
        searchInputRef?.current && activeEl === searchInputRef.current
      );
      const isEditing = isEditableElement(activeEl);

      // 1. Escape 键全局级联退出契约：任何时候按 Escape 均优先尝试关闭顶层浮层
      if (e.key === 'Escape') {
        if (onCloseTopLayer) {
          const handled = onCloseTopLayer();
          if (handled) {
            e.preventDefault();
            return;
          }
        }
        if (isSearchFocused && searchInputRef?.current) {
          e.preventDefault();
          searchInputRef.current.blur();
          return;
        }
      }

      // 2. Tab 键切换搜索引擎：在搜索框聚焦态或非编辑空闲态下拦截 Tab 切换引擎
      if (e.key === 'Tab' && onCycleEngine) {
        if (isSearchFocused || !isEditing) {
          e.preventDefault();
          e.stopPropagation();
          onCycleEngine(e.shiftKey ? 'prev' : 'next');
          return;
        }
      }

      // 3. `（反引号）键快速聚焦搜索框
      if (e.key === '`' || e.key === '~') {
        // 如果用户在非搜索框的其他可编辑元素（便签、待办）中打字，不抢占焦点
        if (isEditing && !isSearchFocused) {
          return;
        }
        e.preventDefault();
        if (onFocusSearch) {
          onFocusSearch();
        } else if (searchInputRef?.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        return;
      }

      // 4. 输入态守卫：在可编辑输入框中打字时，后续字母单键快捷键全部休眠避让
      if (isEditing) {
        return;
      }

      // 5. 辅助键过滤：忽略带 Ctrl / Alt / Meta(Command) 的系统组合键
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      // 6. 快捷键指南浮层：? 或 Shift+/
      if (e.key === '?' && onToggleHelp) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      // 7. 打开/关闭外观抽屉：e 或 s
      if ((e.key === 'e' || e.key === 's') && onToggleDrawer) {
        e.preventDefault();
        onToggleDrawer();
        return;
      }

      // 7.5. 打开/关闭订阅消息侧边栏：b (T17)
      if (e.key === 'b' && onToggleFeedSidebar) {
        e.preventDefault();
        onToggleFeedSidebar();
        return;
      }

      // 8. 打开/关闭添加组件弹窗：a
      if (e.key === 'a' && onToggleAddModal) {
        e.preventDefault();
        onToggleAddModal();
        return;
      }

      // 9. 切换极简折叠模式：c
      if (e.key === 'c' && onToggleCollapse) {
        e.preventDefault();
        onToggleCollapse();
        return;
      }
    },
    [
      onFocusSearch,
      onCycleEngine,
      onCloseTopLayer,
      onToggleHelp,
      onToggleDrawer,
      onToggleFeedSidebar,
      onToggleAddModal,
      onToggleCollapse,
      searchInputRef,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
