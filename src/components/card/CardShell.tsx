import React, { useState } from 'react';
import { WidgetInstance, WidgetManifest, WidgetState } from '../../contract/types';
import { X, Settings, AlertCircle, WifiOff, Lock, Database, HelpCircle, Loader2 } from 'lucide-react';

interface CardShellProps {
  instance: WidgetInstance;
  manifest?: WidgetManifest;
  state?: WidgetState;
  errorMessage?: string;
  onRemove?: () => void;
  onOpenSettings?: () => void;
  children?: React.ReactNode;
}

export const CardShell: React.FC<CardShellProps> = ({
  instance,
  manifest,
  state = 'ready',
  errorMessage,
  onRemove,
  onOpenSettings,
  children,
}) => {
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);

  const title = manifest?.displayName || instance.typeId;

  // Render uniform state overlay/placeholder
  const renderStateContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center p-8 space-y-2 text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
            <span className="text-xs">加载中...</span>
          </div>
        );
      case 'empty':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-stone-400">
            <span className="text-xs">暂无数据</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center p-6 space-y-2 text-rose-500">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs text-center">{errorMessage || '组件加载失败'}</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex flex-col items-center justify-center p-6 space-y-2 text-amber-600">
            <WifiOff className="w-6 h-6" />
            <span className="text-xs">离线模式，无法更新数据</span>
          </div>
        );
      case 'unauthorized':
        return (
          <div className="flex flex-col items-center justify-center p-6 space-y-2 text-amber-600">
            <Lock className="w-6 h-6" />
            <span className="text-xs">未授权访问该外部数据源</span>
          </div>
        );
      case 'quota_exceeded':
        return (
          <div className="flex flex-col items-center justify-center p-6 space-y-2 text-amber-600">
            <Database className="w-6 h-6" />
            <span className="text-xs">存储配额已超限，请清理空间</span>
          </div>
        );
      case 'unknown_type':
        return (
          <div className="flex flex-col items-center justify-center p-6 space-y-2 text-stone-400">
            <HelpCircle className="w-6 h-6" />
            <span className="text-xs font-medium text-stone-600">未知组件类型 ({instance.typeId})</span>
            <span className="text-[11px] text-stone-400 text-center">
              该组件来自其他版本或环境，数据已保留且不会丢失
            </span>
          </div>
        );
      case 'ready':
      default:
        return children;
    }
  };

  return (
    <div
      className="relative flex flex-col bg-white/70 dark:bg-stone-900/70 backdrop-blur-md rounded-2xl border border-black/5 dark:border-white/10 shadow-sm transition-all overflow-hidden"
      style={{
        minHeight: manifest?.minContentHeight ? `${manifest.minContentHeight}px` : '120px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/5 select-none">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium tracking-wide text-stone-700 dark:text-stone-300">
            {title}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {manifest?.settingsSchema && manifest.settingsSchema.length > 0 && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-1 rounded-md text-stone-400 hover:text-stone-600 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="设置"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => setShowConfirmRemove(true)}
              className="p-1 rounded-md text-stone-400 hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="移除组件"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Remove Confirmation */}
      {showConfirmRemove && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm">
          <p className="text-xs text-stone-600 dark:text-stone-300 mb-3 text-center">
            移除后卡片将隐藏，已保存的个人数据仍会保留。
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setShowConfirmRemove(false);
                onRemove?.();
              }}
              className="px-3 py-1 text-xs rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-medium transition-colors"
            >
              确认移除
            </button>
            <button
              onClick={() => setShowConfirmRemove(false)}
              className="px-3 py-1 text-xs rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">{renderStateContent()}</div>
    </div>
  );
};
