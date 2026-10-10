import React, { useState, useEffect, useCallback } from 'react';
import {
  ClockAppearance,
  SearchAppearance,
  BackgroundConfig,
  FontStyle,
  AlignStyle,
  ShadowStyle,
  BackgroundType,
} from '../../services/storage/types';
import { X, RotateCcw, Clock, Search, Image as ImageIcon, Upload, Keyboard, SlidersHorizontal } from 'lucide-react';
import { wallpaperStorage } from '../../services/storage/wallpaper';
import { useDelayedUnmount } from '../../hooks/useDelayedUnmount';

interface AppearanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  clock: ClockAppearance;
  search: SearchAppearance;
  background: BackgroundConfig;
  shortcutKeysEnabled?: boolean;
  onUpdateClock: (clock: Partial<ClockAppearance>) => void;
  onResetClock: () => void;
  onUpdateSearch: (search: Partial<SearchAppearance>) => void;
  onResetSearch: () => void;
  onUpdateBackground: (bg: Partial<BackgroundConfig>) => void;
  onResetBackground: () => void;
  onUpdateShortcutKeysEnabled?: (enabled: boolean) => void;
}

export const AppearanceDrawer: React.FC<AppearanceDrawerProps> = ({
  isOpen,
  onClose,
  clock,
  search,
  background,
  shortcutKeysEnabled = true,
  onUpdateClock,
  onResetClock,
  onUpdateSearch,
  onResetSearch,
  onUpdateBackground,
  onResetBackground,
  onUpdateShortcutKeysEnabled,
}) => {
  const [activeTab, setActiveTab] = useState<'clock' | 'search' | 'background' | 'shortcuts'>('clock');
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
      className="t-panel-overlay fixed inset-0 z-50 flex justify-end p-3 sm:p-4 bg-black/25 dark:bg-black/40 backdrop-blur-xs overflow-hidden"
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
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-stone-800 dark:text-white tracking-wide">
                工作台外观设置
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                个性化布局与视觉风格 · 实时预览即时生效
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

        {/* Tab Navigation (Segmented Control 防折行设计) */}
        <div className="px-5 pt-3 pb-2 border-b border-black/5 dark:border-white/5">
          <div className="grid grid-cols-4 p-1 bg-black/5 dark:bg-white/5 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('clock')}
              className={`py-1.5 px-1.5 text-xs font-medium rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'clock'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="时钟与日期设置"
            >
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>时钟</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`py-1.5 px-1.5 text-xs font-medium rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'search'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="搜索栏外观与圆角"
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" />
              <span>搜索</span>
            </button>
            <button
              onClick={() => setActiveTab('background')}
              className={`py-1.5 px-1.5 text-xs font-medium rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'background'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="壁纸、材质与背景"
            >
              <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>壁纸</span>
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`py-1.5 px-1.5 text-xs font-medium rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'shortcuts'
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-xs font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              title="网页图标快捷键"
            >
              <Keyboard className="w-3.5 h-3.5 flex-shrink-0" />
              <span>快捷键</span>
            </button>
          </div>
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

              {/* Timezone (T10) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>时区设置</span>
                  <span>{clock.timezone && clock.timezone !== 'auto' ? clock.timezone : '本地系统'}</span>
                </div>
                <select
                  value={clock.timezone || 'auto'}
                  onChange={(e) => onUpdateClock({ timezone: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 outline-hidden transition-all focus:border-stone-400 dark:focus:border-stone-600 cursor-pointer"
                >
                  <option value="auto">自动 (跟随系统本地时区)</option>
                  <option value="Asia/Shanghai">中国标准时间 (北京/上海 - UTC+8)</option>
                  <option value="Asia/Hong_Kong">香港时间 (UTC+8)</option>
                  <option value="Asia/Taipei">台北时间 (UTC+8)</option>
                  <option value="Asia/Tokyo">日本标准时间 (东京 - UTC+9)</option>
                  <option value="Asia/Seoul">首尔时间 (UTC+9)</option>
                  <option value="Asia/Singapore">新加坡时间 (UTC+8)</option>
                  <option value="Asia/Dubai">迪拜时间 (UTC+4)</option>
                  <option value="UTC">世界协调时 (UTC)</option>
                  <option value="Europe/London">伦敦时间 (UTC+0/+1)</option>
                  <option value="Europe/Paris">巴黎/柏林时间 (UTC+1/+2)</option>
                  <option value="Europe/Moscow">莫斯科时间 (UTC+3)</option>
                  <option value="America/New_York">美东时间 (纽约 - UTC-5/-4)</option>
                  <option value="America/Chicago">美中部时间 (芝加哥 - UTC-6/-5)</option>
                  <option value="America/Denver">美山地时间 (丹佛 - UTC-7/-6)</option>
                  <option value="America/Los_Angeles">美西时间 (洛杉矶 - UTC-8/-7)</option>
                  <option value="Pacific/Auckland">新西兰时间 (奥克兰 - UTC+12/+13)</option>
                  <option value="Australia/Sydney">悉尼时间 (UTC+10/+11)</option>
                </select>
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

              {/* Border Radius (T10) */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400">
                  <span>圆角大小</span>
                  <span>{search.radius ?? 24} px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="28"
                  step="2"
                  value={search.radius ?? 24}
                  onChange={(e) => onUpdateSearch({ radius: Number(e.target.value) })}
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
                </div>
              )}
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  常用网站快捷键
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  按住 ⌘ (Command / Meta) 键时，常用网站当前页前 9 个图标下方平滑浮现 ⌘1~⌘9 按键提示徽标；按下 ⌘ + 数字键瞬时直达网页。
                </p>
              </div>

              {/* Toggle Switch */}
              <div className="p-4 rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <div className="text-xs font-medium text-stone-800 dark:text-stone-200">
                      启用 ⌘ + 数字键选取与按键提示
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      按住 Command 浮现 ⌘1~⌘9 提示徽标，支持 ⌘1~9 秒开网站
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={shortcutKeysEnabled !== false}
                    onChange={(e) => onUpdateShortcutKeysEnabled?.(e.target.checked)}
                    className="w-4 h-4 accent-stone-900 dark:accent-white cursor-pointer"
                  />
                </div>
              </div>

              {/* Shortcut Cheat Sheet */}
              <div className="space-y-2">
                <label className="text-xs text-stone-600 dark:text-stone-400">
                  当前支持的网页快捷键
                </label>
                <div className="space-y-1.5">
                  {[
                    { key: '⌘ + 1~9', desc: '秒开常用网站当前页第 1~9 个网页图标' },
                    { key: '按住 ⌘', desc: '在常用网站图标下方显现实时按键提示徽标' },
                    { key: '← / →', desc: '在常用网站分页间切换上一页 / 下一页' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.015] dark:bg-white/[0.02]"
                    >
                      <span className="text-xs text-stone-700 dark:text-stone-300">
                        {item.desc}
                      </span>
                      <kbd className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-black/10 dark:border-white/15 shadow-2xs">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
