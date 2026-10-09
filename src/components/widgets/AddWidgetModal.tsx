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
  // 150ms 与 motion.css 的 --modal-close-dur 保持一致，退出动画播完再卸载
  const { mounted, open } = useDelayedUnmount(isOpen, 150);

  if (!mounted) return null;

  const manifests = widgetRegistry.getAllManifests();

  return (
    <div
      data-open={open}
      onClick={onClose}
      className="t-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none"
    >
      <div
        data-open={open}
        onClick={(e) => e.stopPropagation()}
        className="t-modal w-full max-w-md p-6 bg-white dark:bg-stone-900 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
          <h3 className="text-sm font-semibold text-stone-800 dark:text-white">
            添加效率组件
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
          {manifests.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-6">暂无已注册组件</p>
          ) : (
            manifests.map((manifest) => {
              // Single instance policy check: is there a visible instance in layout?
              const isAdded = layout.some((item) => item.typeId === manifest.typeId && item.visible);

              return (
                <div
                  key={manifest.typeId}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    isAdded
                      ? 'bg-stone-50 dark:bg-stone-800/40 border-stone-100 dark:border-stone-800 opacity-60'
                      : 'bg-white dark:bg-stone-850 border-stone-200/80 dark:border-stone-800 hover:border-stone-400 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-stone-800 dark:text-stone-200">
                      {manifest.displayName}
                    </span>
                    <span className="text-[11px] text-stone-400 mt-0.5">
                      默认跨度：{manifest.defaultSpan} 列
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
                      className="flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black dark:bg-white dark:hover:bg-stone-200 text-white dark:text-stone-900 text-xs font-medium transition-colors shadow-xs"
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
