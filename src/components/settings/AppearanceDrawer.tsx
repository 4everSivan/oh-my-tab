import React, { useState, useEffect, useCallback } from 'react';
import {
  ClockAppearance,
  SearchAppearance,
  BackgroundConfig,
  FontStyle,
  AlignStyle,
  ShadowStyle,
  BackgroundType,
  BackgroundPosition,
} from '../../services/storage/types';
import { X, RotateCcw, Clock, Search, Image as ImageIcon, Upload } from 'lucide-react';
import { wallpaperStorage } from '../../services/storage/wallpaper';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';

interface AppearanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clock: ClockAppearance;
  search: SearchAppearance;
  background: BackgroundConfig;
  onUpdateClock: (clock: Partial<ClockAppearance>) => void;
  onResetClock: () => void;
  onUpdateSearch: (search: Partial<SearchAppearance>) => void;
  onResetSearch: () => void;
  onUpdateBackground: (bg: Partial<BackgroundConfig>) => void;
  onResetBackground: () => void;
}

export const AppearanceDrawer: React.FC<AppearanceDrawerProps> = ({
  isOpen,
  onClose,
  clock,
  search,
  background,
  onUpdateClock,
  onResetClock,
  onUpdateSearch,
  onResetSearch,
  onUpdateBackground,
  onResetBackground,
}) => {
  const [activeTab, setActiveTab] = useState<'clock' | 'search' | 'background'>('clock');
  // 上传失败的可见反馈（C001：此前异常被静默吞掉，用户零感知）
  const [uploadError, setUploadError] = useState<string | null>(null);
  // 拖拽悬停高亮（C002：webview 无文件选择器，拖拽是等价上传通道）
  const [isDragOver, setIsDragOver] = useState(false);

  // 350ms 与 motion.css 的 --panel-close-dur 保持一致，退出动画播完再卸载
  const { mounted, open } = useDelayedUnmount(isOpen, 350);

  // 点击选择与拖拽文件共用的唯一保存链路（C001 恢复/反馈语义在此收口）
  // 白名单而非 image/* 通配：HEIC 等 MIME 以 image/ 开头但 Chromium 无法解码，
  // 放行会重现"存了却显示不出来"的静默失效
  const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'];

  // 注意：以下 useCallback/useEffect 必须位于早退之前——React 钩子不得条件调用，
  // 否则抽屉开合切换钩子数量会触发崩溃（白屏卸载整树）
  const applyWallpaperFile = useCallback(async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('仅支持 PNG/JPEG/WebP/GIF/BMP/AVIF 图片；HEIC 等格式请先转换为 PNG/JPEG');
      return;
    }
    // 解码验证：MIME 正确也可能无法解码（损坏文件/伪装扩展名），失败不落库
    const objectUrl = URL.createObjectURL(file);
    const decodable = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = objectUrl;
      window.setTimeout(() => resolve(false), 4000);
    });
    if (!decodable) {
      URL.revokeObjectURL(objectUrl);
      setUploadError('该图片无法解码显示，请换一张或重新导出为 PNG/JPEG');
      return;
    }
    setUploadError(null);
    const id = `wallpaper-${Date.now()}`;
    try {
      await wallpaperStorage.saveWallpaper(id, file, file.name, file.type);
      // 回收上一张壁纸的派生地址，防止会话内 Blob 泄漏
      if (background.imageBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(background.imageBlobUrl);
      }
      onUpdateBackground({
        type: 'image',
        imageId: id,
        imageBlobUrl: objectUrl,
        name: file.name,
      });
    } catch {
      URL.revokeObjectURL(objectUrl);
      setUploadError('壁纸保存失败，请重试；若持续失败请检查浏览器存储权限');
    }
    // 依赖 background（回收旧地址）与 onUpdateBackground；白名单为模块级常量语义
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background.imageBlobUrl, onUpdateBackground]);

  // 粘贴通道（webview 无选择器且 OS 拖拽不送达时的第三通道）：
  // 壁纸 tab 激活期间监听全局 paste，复用同一保存链路
  useEffect(() => {
    if (activeTab !== 'background') return;
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (!file) return;
      e.preventDefault();
      void applyWallpaperFile(file);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeTab, applyWallpaperFile]);

  if (!mounted) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await applyWallpaperFile(file);
    // 清空 value 允许连续两次选择同一文件
    e.target.value = '';
  };

  const handleWallpaperDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await applyWallpaperFile(file);
  };

  return (
    <div
      data-open={open}
      onClick={onClose}
      className="t-panel-overlay fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs"
    >
      <div
        data-open={open}
        onClick={(e) => e.stopPropagation()}
        className="t-panel-slide w-full max-w-md h-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl border-l border-black/10 dark:border-white/10 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5">
          <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-wide">
            工作台外观设置
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-black/5 dark:border-white/5 px-6">
          <button
            onClick={() => setActiveTab('clock')}
            className={`py-3 px-3 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'clock'
                ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
                : 'border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>时间与日期</span>
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-3 px-3 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'search'
                ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
                : 'border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>搜索框</span>
          </button>
          <button
            onClick={() => setActiveTab('background')}
            className={`py-3 px-3 text-xs font-medium flex items-center space-x-1.5 border-b-2 transition-colors ${
              activeTab === 'background'
                ? 'border-stone-900 dark:border-white text-stone-900 dark:text-white'
                : 'border-transparent text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>壁纸与背景</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'clock' && (
            <div className="space-y-5">
              {/* Reset Clock */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 font-medium">时间设置</span>
                <button
                  onClick={onResetClock}
                  className="flex items-center space-x-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复时间默认</span>
                </button>
              </div>

              {/* Font */}
              <div className="space-y-2">
                <label className="text-xs text-stone-600 dark:text-stone-400">字体风格</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['modern', 'mono', 'serif'] as FontStyle[]).map((font) => (
                    <button
                      key={font}
                      onClick={() => onUpdateClock({ font })}
                      className={`py-2 text-xs rounded-xl border transition-all ${
                        clock.font === font
                          ? 'border-stone-900 dark:border-white bg-black/5 dark:bg-white/10 font-medium'
                          : 'border-stone-200 dark:border-stone-800 hover:border-stone-300'
                      }`}
                    >
                      {font === 'modern' ? '现代无衬线' : font === 'mono' ? '等宽' : '经典衬线'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>字号大小</span>
                  <span>{clock.size} px</span>
                </div>
                <input
                  type="range"
                  min="48"
                  max="144"
                  step="4"
                  value={clock.size}
                  onChange={(e) => onUpdateClock({ size: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Weight */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>字重粗细</span>
                  <span>{clock.weight}</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="100"
                  value={clock.weight}
                  onChange={(e) => onUpdateClock({ weight: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Top Spacing */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>顶部留白</span>
                  <span>{clock.top} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="240"
                  step="2"
                  value={clock.top}
                  onChange={(e) => onUpdateClock({ top: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Alignment */}
              <div className="space-y-2">
                <label className="text-xs text-stone-600 dark:text-stone-400">水平位置</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'right'] as AlignStyle[]).map((align) => (
                    <button
                      key={align}
                      onClick={() => onUpdateClock({ align })}
                      className={`py-2 text-xs rounded-xl border transition-all ${
                        clock.align === align
                          ? 'border-stone-900 dark:border-white bg-black/5 dark:bg-white/10 font-medium'
                          : 'border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      {align === 'left' ? '居左' : align === 'center' ? '居中' : '居右'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shadow & Toggles */}
              <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-700 dark:text-stone-300">显示日期</span>
                  <input
                    type="checkbox"
                    checked={clock.showDate}
                    onChange={(e) => onUpdateClock({ showDate: e.target.checked })}
                    className="rounded accent-stone-800 dark:accent-white w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-700 dark:text-stone-300">显示秒数</span>
                  <input
                    type="checkbox"
                    checked={clock.showSeconds}
                    onChange={(e) => onUpdateClock({ showSeconds: e.target.checked })}
                    className="rounded accent-stone-800 dark:accent-white w-4 h-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-stone-700 dark:text-stone-300">柔和深色投影</span>
                  <input
                    type="checkbox"
                    checked={clock.shadow === 'soft'}
                    onChange={(e) =>
                      onUpdateClock({ shadow: (e.target.checked ? 'soft' : 'none') as ShadowStyle })
                    }
                    className="rounded accent-stone-800 dark:accent-white w-4 h-4"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-5">
              {/* Reset Search */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 font-medium">搜索框外观</span>
                <button
                  onClick={onResetSearch}
                  className="flex items-center space-x-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复搜索默认</span>
                </button>
              </div>

              {/* Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>宽度</span>
                  <span>{search.width} px</span>
                </div>
                <input
                  type="range"
                  min="320"
                  max="760"
                  step="20"
                  value={search.width}
                  onChange={(e) => onUpdateSearch({ width: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Gap */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>上方间距</span>
                  <span>{search.gap} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="2"
                  value={search.gap}
                  onChange={(e) => onUpdateSearch({ gap: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Transparency */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>背景透明度</span>
                  <span>{search.transparency} %</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={search.transparency}
                  onChange={(e) => onUpdateSearch({ transparency: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Blur */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>背景模糊 (毛玻璃)</span>
                  <span>{search.blur} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={search.blur}
                  onChange={(e) => onUpdateSearch({ blur: Number(e.target.value) })}
                  className="w-full accent-stone-800 dark:accent-white"
                />
              </div>

              {/* Alignment */}
              <div className="space-y-2">
                <label className="text-xs text-stone-600 dark:text-stone-400">水平对齐</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['left', 'center', 'right'] as AlignStyle[]).map((align) => (
                    <button
                      key={align}
                      onClick={() => onUpdateSearch({ align })}
                      className={`py-2 text-xs rounded-xl border transition-all ${
                        search.align === align
                          ? 'border-stone-900 dark:border-white bg-black/5 dark:bg-white/10 font-medium'
                          : 'border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      {align === 'left' ? '居左' : align === 'center' ? '居中' : '居右'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'background' && (
            <div className="space-y-5">
              {/* Reset Background */}
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-500 font-medium">背景与风格</span>
                <button
                  onClick={onResetBackground}
                  className="flex items-center space-x-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>恢复材质默认</span>
                </button>
              </div>

              {/* Background Mode */}
              <div className="space-y-2">
                <label className="text-xs text-stone-600 dark:text-stone-400">背景类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['material', 'color', 'image'] as BackgroundType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => onUpdateBackground({ type })}
                      className={`py-2 text-xs rounded-xl border transition-all ${
                        background.type === type
                          ? 'border-stone-900 dark:border-white bg-black/5 dark:bg-white/10 font-medium'
                          : 'border-stone-200 dark:border-stone-800'
                      }`}
                    >
                      {type === 'material' ? '精选材质' : type === 'color' ? '纯色' : '自定义图片'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Materials */}
              {background.type === 'material' && (
                <div className="space-y-2">
                  <label className="text-xs text-stone-600 dark:text-stone-400">材质预设</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'paper', name: '纸感书桌', color: '#f5f4ef' },
                      { id: 'mist', name: '雾蓝工作台', color: '#e6edf5' },
                      { id: 'dark', name: '墨黑仪表台', color: '#16191d' },
                    ].map((mat) => (
                      <button
                      key={mat.id}
                      onClick={() => onUpdateBackground({ type: 'material', name: mat.id, color: mat.color })}
                      className={`p-3 rounded-xl border text-xs flex flex-col items-center space-y-1.5 transition-all ${
                          background.name === mat.id
                            ? 'border-stone-900 dark:border-white font-medium ring-1 ring-stone-900 dark:ring-white'
                            : 'border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        <div
                          className="w-full h-8 rounded-lg border border-black/5"
                          style={{ backgroundColor: mat.color }}
                        />
                        <span>{mat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pure Color */}
              {background.type === 'color' && (
                <div className="space-y-2">
                  <label className="text-xs text-stone-600 dark:text-stone-400">背景颜色</label>
                  <input
                    type="color"
                    value={background.color}
                    onChange={(e) => onUpdateBackground({ color: e.target.value })}
                    className="w-full h-10 rounded-xl cursor-pointer bg-transparent border border-stone-200 dark:border-stone-800 p-1"
                  />
                </div>
              )}

              {/* Image Upload & Settings */}
              {background.type === 'image' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-stone-600 dark:text-stone-400">上传本地壁纸</label>
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleWallpaperDrop}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border border-dashed cursor-pointer transition-colors ${
                        isDragOver
                          ? 'border-stone-900 dark:border-white bg-black/5 dark:bg-white/10'
                          : 'border-stone-300 dark:border-stone-700 hover:border-stone-400'
                      }`}
                    >
                      <Upload className={`w-5 h-5 mb-1 ${isDragOver ? 'text-stone-700 dark:text-stone-200' : 'text-stone-400'}`} />
                      <span className="text-xs text-stone-600 dark:text-stone-300">
                        {isDragOver
                          ? '松开以设置壁纸'
                          : background.name
                            ? background.name
                            : '点击选择 / 拖拽 / ⌘V 粘贴图片 (PNG/JPEG/WebP)'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                    {uploadError && (
                      <p className="text-xs text-rose-500" role="alert">{uploadError}</p>
                    )}
                  </div>

                  {/* Shade */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                      <span>遮罩浓度</span>
                      <span>{background.shade} %</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="85"
                      step="5"
                      value={background.shade}
                      onChange={(e) => onUpdateBackground({ shade: Number(e.target.value) })}
                      className="w-full accent-stone-800 dark:accent-white"
                    />
                  </div>

                  {/* Image Blur */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                      <span>壁纸模糊</span>
                      <span>{background.blur} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      value={background.blur}
                      onChange={(e) => onUpdateBackground({ blur: Number(e.target.value) })}
                      className="w-full accent-stone-800 dark:accent-white"
                    />
                  </div>

                  {/* Position */}
                  <div className="space-y-2">
                    <label className="text-xs text-stone-600 dark:text-stone-400">画面位置</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['top', 'center', 'bottom'] as BackgroundPosition[]).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => onUpdateBackground({ position: pos })}
                          className={`py-2 text-xs rounded-xl border transition-all ${
                            background.position === pos
                              ? 'border-stone-900 dark:border-white bg-black/5 dark:bg-white/10 font-medium'
                              : 'border-stone-200 dark:border-stone-800'
                          }`}
                        >
                          {pos === 'top' ? '靠上' : pos === 'center' ? '居中' : '靠下'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
