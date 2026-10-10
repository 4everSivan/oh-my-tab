import React from 'react';
import { LayoutItem } from '../../services/storage/types';
import { widgetRegistry } from '../../contract/registry';
import { WidgetManifest } from '../../contract/types';
import { X, Plus, Check } from 'lucide-react';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';

interface AddWidgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  layout: LayoutItem[];
  onAddWidget: (manifest: WidgetManifest) => void;
}

export const AddWidgetModal: React.FC<AddWidgetModalProps> = ({
  isOpen,
  onClose,
  layout,
  onAddWidget,
}) => {
  // 350ms 与 motion.css 的 --panel-close-dur 保持一致，退出动画播完再卸载
  const { mounted, open } = useDelayedUnmount(isOpen, 350);

  if (!mounted) return null;

  const manifests = widgetRegistry.getAllManifests();

  return (
    <div
      data-open={open}
      onClick={onClose}
      className="t-panel-overlay fixed inset-0 z-50 flex justify-end p-3 sm:p-4 bg-black/25 dark:bg-black/40 backdrop-blur-xs overflow-hidden select-none"
    >
      <div
        data-open={open}
        onClick={(e) => e.stopPropagation()}
        className="t-panel-slide w-full max-w-md h-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5 dark:border-white/5">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/10 text-stone-800 dark:text-stone-200">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-800 dark:text-white">
                添加效率组件
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                按需扩展桌面能力 · 点击即可添加至看板
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="关闭 (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {manifests.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-12">暂无已注册组件</p>
          ) : (
            manifests.map((manifest) => {
              // Single instance policy check: is there a visible instance in layout?
              const isAdded = layout.some((item) => item.typeId === manifest.typeId && item.visible);

              return (
                <div
                  key={manifest.typeId}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    isAdded
                      ? 'bg-stone-50 dark:bg-stone-800/40 border-stone-100 dark:border-stone-800 opacity-60'
                      : 'bg-white dark:bg-stone-850 border-stone-200/80 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      {manifest.displayName}
                    </span>
                    <span className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                      默认占用 {manifest.defaultSpan} 列栅格宽度
                    </span>
                  </div>

                  {isAdded ? (
                    <span className="flex items-center space-x-1 px-3 py-1.5 text-xs text-stone-400 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      <span>已添加</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        onAddWidget(manifest);
                        onClose();
                      }}
                      className="flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 text-xs font-medium transition-colors shadow-xs cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>添加</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
