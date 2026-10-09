import React, { useState, useEffect, useRef } from 'react';
import {
  storageService,
  ClockAppearance,
  SearchAppearance,
  BackgroundConfig,
  Shortcut,
  LayoutItem,
  DEFAULT_CLOCK_APPEARANCE,
  DEFAULT_SEARCH_APPEARANCE,
  DEFAULT_BACKGROUND_CONFIG,
} from './services/storage';
import { Clock } from './components/clock/Clock';
import { SearchBar } from './components/search/SearchBar';
import { Shortcuts } from './components/shortcuts/Shortcuts';
import { GridContainer } from './components/layout/GridContainer';
import { AppearanceDrawer } from './components/settings/AppearanceDrawer';
import { AddWidgetModal } from './components/widgets/AddWidgetModal';
import { WidgetManifest } from './contract/types';
import { createWidgetInstance } from './contract/widget';
import { planBackgroundRestore } from './utils/background';
import { useWallpaperContrast } from './hooks/useWallpaperContrast';
import { SlidersHorizontal, Plus } from 'lucide-react';

export const App: React.FC = () => {
  const [clock, setClock] = useState<ClockAppearance>(DEFAULT_CLOCK_APPEARANCE);
  const [search, setSearch] = useState<SearchAppearance>(DEFAULT_SEARCH_APPEARANCE);
  const [engine, setEngine] = useState('google');
  const [background, setBackground] = useState<BackgroundConfig>(DEFAULT_BACKGROUND_CONFIG);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const clockContainerRef = useRef<HTMLDivElement>(null);

  // Load all configurations on mount
  useEffect(() => {
    async function loadAll() {
      const c = await storageService.getClock();
      const s = await storageService.getSearch();
      const e = await storageService.getEngine();
      const b = await storageService.getBackground();
      const sc = await storageService.getShortcuts();
      const l = await storageService.getLayout();

      // 壁纸恢复（C001）：imageBlobUrl 是会话级派生地址，刷新后死链；
      // 以 imageId 从 IndexedDB 取回 Blob 重建；记录缺失时回退材质并回写存储
      let background = b;
      if (b.type === 'image' && b.imageId) {
        const record = await storageService.wallpaper.getWallpaper(b.imageId);
        const plan = planBackgroundRestore(b, !!record);
        if (plan.kind === 'restore' && record) {
          background = {
            ...plan.config,
            imageBlobUrl: URL.createObjectURL(
              record.data instanceof Blob ? record.data : new Blob([record.data])
            ),
          };
        } else if (plan.kind === 'fallback') {
          await storageService.setBackground(plan.config);
          background = plan.config;
        }
      }

      setClock(c);
      setSearch(s);
      setEngine(e);
      setBackground(background);
      setShortcuts(sc);
      setLayout(l);
    }
    loadAll();
  }, []);

  // Canvas-based geometric luminance sampling and adaptive contrast protection
  const { textColor, shadowProtection } = useWallpaperContrast(background, clockContainerRef);

  // Background style computation
  const getBackgroundStyle = (): React.CSSProperties => {
    if (background.type === 'image' && background.imageBlobUrl) {
      return {
        backgroundImage: `url(${background.imageBlobUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: background.position,
        filter: background.blur > 0 ? `blur(${background.blur}px)` : 'none',
      };
    }
    return {
      backgroundColor: background.color,
    };
  };

  // Handlers for settings
  const handleUpdateClock = async (updates: Partial<ClockAppearance>) => {
    const updated = await storageService.setClock(updates);
    setClock(updated);
  };

  const handleResetClock = async () => {
    const reset = await storageService.resetClock();
    setClock(reset);
  };

  const handleUpdateSearch = async (updates: Partial<SearchAppearance>) => {
    const updated = await storageService.setSearch(updates);
    setSearch(updated);
  };

  const handleResetSearch = async () => {
    const reset = await storageService.resetSearch();
    setSearch(reset);
  };

  const handleUpdateBackground = async (updates: Partial<BackgroundConfig>) => {
    const updated = await storageService.setBackground(updates);
    setBackground(updated);
  };

  const handleResetBackground = async () => {
    const reset = await storageService.resetBackground();
    setBackground(reset);
  };

  const handleEngineChange = async (newEngine: string) => {
    await storageService.setEngine(newEngine);
    setEngine(newEngine);
  };

  const handleShortcutsChange = async (newShortcuts: Shortcut[]) => {
    await storageService.setShortcuts(newShortcuts);
    setShortcuts(newShortcuts);
  };

  // Add widget with single-instance check
  const handleAddWidget = async (manifest: WidgetManifest) => {
    // Check if there is an existing hidden instance of this type to restore
    const existingIndex = layout.findIndex((item) => item.typeId === manifest.typeId);

    if (existingIndex !== -1) {
      // Re-enable existing instance (preserves content!)
      const updated = [...layout];
      updated[existingIndex] = { ...updated[existingIndex], visible: true };
      await storageService.setLayout(updated);
      setLayout(updated);
    } else {
      // Create new instance
      const newInstance = createWidgetInstance(manifest);
      newInstance.order = layout.length;
      const updated = [...layout, newInstance];
      await storageService.setLayout(updated);
      setLayout(updated);
    }
  };

  // Remove widget (marks visible = false, preserving content!)
  const handleRemoveWidget = async (instanceId: string) => {
    const updated = layout.map((item) =>
      item.instanceId === instanceId ? { ...item, visible: false } : item
    );
    await storageService.setLayout(updated);
    setLayout(updated);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden selection:bg-stone-300 selection:text-stone-900">
      {/* Background layer */}
      <div
        className="fixed inset-0 -z-20 transition-all duration-300"
        style={getBackgroundStyle()}
      />

      {/* Shade overlay for image background */}
      {background.type === 'image' && background.shade > 0 && (
        <div
          className="fixed inset-0 -z-10 bg-black transition-opacity"
          style={{ opacity: background.shade / 100 }}
        />
      )}

      {/* Header controls (stays in layout to preserve vertical height; fades smoothly in collapse mode) */}
      <header
        className={`w-full flex items-center justify-between p-6 z-10 select-none transition-opacity duration-300 ${
          isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="text-xs font-semibold tracking-wider uppercase opacity-60" style={{ color: textColor }}>
          oh-my-tab
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-xs font-medium text-stone-700 dark:text-stone-200 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加组件</span>
          </button>
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-stone-700 dark:text-stone-200 transition-all active:scale-95"
            title="外观设置"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Workbench Area */}
      <main className="flex-1 flex flex-col items-center justify-start w-full px-4 z-0">
        {/* Clock & Date */}
        <div ref={clockContainerRef} className="w-full">
          <Clock
            appearance={clock}
            isCollapsed={isCollapsed}
            textColor={textColor}
            shadowProtection={shadowProtection}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        {/* Search Bar */}
        <SearchBar
          appearance={search}
          engineId={engine}
          onEngineChange={handleEngineChange}
        />

        {/* Collapsible Workspace Container (smooth accordion transition) */}
        <div
          className="workspace-container w-full"
          data-collapsed={isCollapsed ? 'true' : 'false'}
          aria-hidden={isCollapsed}
        >
          {/* Shortcuts Navigation */}
          <div className="w-full mt-6">
            <Shortcuts
              shortcuts={shortcuts}
              textColor={textColor}
              onChange={handleShortcutsChange}
            />
          </div>

          {/* 12-Column Responsive Widgets Area */}
          <div className="w-full mt-4">
            <GridContainer
              layout={layout}
              onRemoveWidget={handleRemoveWidget}
            />
          </div>
        </div>
      </main>

      {/* Footer / Hint */}
      <footer className="w-full py-4 text-center select-none text-[11px] opacity-40 hover:opacity-70 transition-opacity" style={{ color: textColor }}>
        {isCollapsed ? '点击时间可展开工作台' : '点击时间进入极简模式'}
      </footer>

      {/* Appearance Settings Drawer */}
      <AppearanceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        clock={clock}
        search={search}
        background={background}
        onUpdateClock={handleUpdateClock}
        onResetClock={handleResetClock}
        onUpdateSearch={handleUpdateSearch}
        onResetSearch={handleResetSearch}
        onUpdateBackground={handleUpdateBackground}
        onResetBackground={handleResetBackground}
      />

      {/* Add Widget Modal */}
      <AddWidgetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        layout={layout}
        onAddWidget={handleAddWidget}
      />
    </div>
  );
};

export default App;
