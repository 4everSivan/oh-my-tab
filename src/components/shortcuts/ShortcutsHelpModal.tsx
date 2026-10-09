import React from 'react';
import { createPortal } from 'react-dom';
import { X, Command, Keyboard } from 'lucide-react';

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keyDesc: string;
  action: string;
  group: string;
}

const SHORTCUT_LIST: ShortcutItem[] = [
  { group: '搜索与引擎', keyDesc: '`', action: '快速对焦到主页搜索框' },
  { group: '搜索与引擎', keyDesc: 'Tab', action: '顺次切换搜索引擎（必应 / 谷歌 / GitHub / Bilibili）' },
  { group: '搜索与引擎', keyDesc: 'Shift + Tab', action: '逆向切换上一款搜索引擎' },
  { group: '视图与浮层', keyDesc: 'Esc', action: '级联退出：关掉抽屉设置、弹窗或搜索焦点' },
  { group: '视图与浮层', keyDesc: 'e / s', action: '打开 / 关闭外观与壁纸设置抽屉' },
  { group: '视图与浮层', keyDesc: 'a', action: '打开 / 关闭添加效率组件弹窗' },
  { group: '视图与浮层', keyDesc: 'c', action: '切换极简模式 / 展开工作台' },
  { group: '视图与浮层', keyDesc: '?', action: '打开 / 关闭本快捷键帮助指南' },
];

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen || typeof document === 'undefined') return null;

  const groups = Array.from(new Set(SHORTCUT_LIST.map((item) => item.group)));

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl p-6 select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 text-stone-800 dark:text-stone-100">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                全局键盘快捷键
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                键盘直达高效操作 · 文本编辑时自动休眠避让
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group} className="space-y-2">
              <div className="text-[11px] font-medium text-stone-400 dark:text-stone-500 tracking-wider">
                {group}
              </div>
              <div className="space-y-1.5">
                {SHORTCUT_LIST.filter((i) => i.group === group).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-xs text-stone-700 dark:text-stone-300">
                      {item.action}
                    </span>
                    <div className="flex items-center space-x-1 flex-shrink-0 ml-3">
                      {item.keyDesc.split(' / ').map((subKey, sIdx) => (
                        <React.Fragment key={sIdx}>
                          {sIdx > 0 && (
                            <span className="text-[10px] text-stone-400 px-0.5">/</span>
                          )}
                          <kbd className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-black/10 dark:border-white/15 shadow-2xs">
                            {subKey}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer tip */}
        <div className="mt-5 pt-3 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500">
          <span>随时按 <kbd className="font-mono text-stone-600 dark:text-stone-300">Esc</kbd> 退出当前弹层</span>
          <span className="flex items-center space-x-1">
            <Command className="w-3 h-3" />
            <span>oh-my-tab</span>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};
