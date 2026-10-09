import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  storageService,
  getBootCache,
  ClockAppearance,
  SearchAppearance,
  BackgroundConfig,
  Shortcut,
  ShortcutGroup,
  LayoutItem,
  DEFAULT_CLOCK_APPEARANCE,
  DEFAULT_SEARCH_APPEARANCE,
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_SHORTCUTS,
  DEFAULT_SHORTCUT_GROUPS,
  DEFAULT_LAYOUT,
} from './services/storage';
import { Clock } from './components/clock/Clock';
import { SearchBar, SEARCH_ENGINES } from './components/search/SearchBar';
import { Shortcuts } from './components/shortcuts/Shortcuts';
import { ShortcutsHelpModal } from './components/shortcuts/ShortcutsHelpModal';
import { GridContainer } from './components/layout/GridContainer';
import { AppearanceDrawer } from './components/settings/AppearanceDrawer';
import { AddWidgetModal } from './components/widgets/AddWidgetModal';
import { WidgetManifest } from './contract/types';
import { createWidgetInstance } from './contract/widget';
import { planBackgroundRestore } from './utils/background';
// useAdaptiveContrast (C015): 统合原 useWallpaperContrast 与 useSearchContrast 为单管线并清空画布释放 GPU 缓冲
import { useAdaptiveContrast } from './hooks/useAdaptiveContrast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SlidersHorizontal, Plus, Keyboard } from 'lucide-react';

export const App: React.FC = () => {
  // 同步启动快照 (C015)：首帧直接读出用户缓存的真实配置，杜绝默认纯色与默认圆角在首帧闪跳
  const boot = getBootCache();
  const [clock, setClock] = useState<ClockAppearance>(() => boot?.clock ?? DEFAULT_CLOCK_APPEARANCE);
  const [search, setSearch] = useState<SearchAppearance>(() => boot?.search ?? DEFAULT_SEARCH_APPEARANCE);
  const [engine, setEngine] = useState<string>(() => boot?.engine ?? 'google');
  const [background, setBackground] = useState<BackgroundConfig>(() => boot?.background ?? DEFAULT_BACKGROUND_CONFIG);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => boot?.shortcuts ?? DEFAULT_SHORTCUTS);
  const [shortcutGroups, setShortcutGroups] = useState<ShortcutGroup[]>(() => {
    if (boot?.shortcutGroups && boot.shortcutGroups.length > 0) {
      return boot.shortcutGroups;
    }
    const legacy = boot?.shortcuts;
    return legacy && legacy.length > 0
      ? [
          {
            id: 'group-default',
            name: '主页',
            shortcuts: legacy,
          },
        ]
      : DEFAULT_SHORTCUT_GROUPS;
  });
  const [activeShortcutGroupId, setActiveShortcutGroupId] = useState<string>(
    () => boot?.activeShortcutGroupId ?? 'group-default'
  );
  const [layout, setLayout] = useState<LayoutItem[]>(() => boot?.layout ?? DEFAULT_LAYOUT);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const clockContainerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentBlobUrlRef = useRef<string | null>(null);

  // 并行批处理加载配置并建立 Blob URL 生命周期回收机制 (C015)
  useEffect(() => {
    let isMounted = true;
    async function loadAll() {
      const {
        clock: c,
        search: s,
        engine: e,
        background: b,
        shortcuts: sc,
        shortcutGroups: sg,
        activeShortcutGroupId: agId,
        layout: l,
      } = await storageService.loadAllSettings();

      if (!isMounted) return;

      let finalBackground = b;
      if (b.type === 'image' && b.imageId) {
        const record = await storageService.wallpaper.getWallpaper(b.imageId);
        const plan = planBackgroundRestore(b, !!record);
        if (plan.kind === 'restore' && record) {
          if (currentBlobUrlRef.current) {
            URL.revokeObjectURL(currentBlobUrlRef.current);
          }
          const newUrl = URL.createObjectURL(
            record.data instanceof Blob ? record.data : new Blob([record.data])
          );
          currentBlobUrlRef.current = newUrl;
          finalBackground = {
            ...plan.config,
            imageBlobUrl: newUrl,
          };
        } else if (plan.kind === 'fallback') {
          await storageService.setBackground(plan.config);
          finalBackground = plan.config;
        }
      }

      setClock(c);
      setSearch(s);
      setEngine(e);
      setBackground(finalBackground);
      setShortcuts(sc);
      if (sg && sg.length > 0) setShortcutGroups(sg);
      if (agId) setActiveShortcutGroupId(agId);
      setLayout(l);
    }
    loadAll();

    return () => {
      isMounted = false;
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
    };
  }, []);

  // 统合采样引擎：时钟与搜索框合并至单离线画布管线，回收 GPU 缓冲 (C015)
  const { clock: clockContrast, search: searchContrast } = useAdaptiveContrast(
    background,
    search,
    clockContainerRef,
    searchContainerRef
  );
  const textColor = clockContrast.textColor;
  const shadowProtection = clockContrast.shadowProtection;
  const searchTextColor = searchContrast.textColor;
  const searchTone = searchContrast.tone;

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
    if (updates.imageBlobUrl && currentBlobUrlRef.current && updates.imageBlobUrl !== currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = updates.imageBlobUrl;
    } else if (updates.type === 'color' && currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    const updated = await storageService.setBackground(updates);
    setBackground(updated);
  };

  const handleResetBackground = async () => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    const reset = await storageService.resetBackground();
    setBackground(reset);
  };

  const handleEngineChange = (newEngine: string) => {
    setEngine(newEngine);
    storageService.setEngine(newEngine).catch(console.error);
  };

  const handleCycleEngine = useCallback((direction: 'next' | 'prev') => {
    setEngine((prevEngine) => {
      const currentIndex = SEARCH_ENGINES.findIndex((eng) => eng.id === prevEngine);
      const len = SEARCH_ENGINES.length;
      const safeIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex =
        direction === 'prev'
          ? (safeIndex - 1 + len) % len
          : (safeIndex + 1) % len;
      const nextEngine = SEARCH_ENGINES[nextIndex].id;
      storageService.setEngine(nextEngine).catch(console.error);
      return nextEngine;
    });
  }, []);

  const handleCloseTopLayer = (): boolean => {
    if (isHelpOpen) {
      setIsHelpOpen(false);
      return true;
    }
    if (isDrawerOpen) {
      setIsDrawerOpen(false);
      return true;
    }
    if (isAddModalOpen) {
      setIsAddModalOpen(false);
      return true;
    }
    if (document.activeElement === searchInputRef.current) {
      searchInputRef.current?.blur();
      return true;
    }
    return false;
  };

  useKeyboardShortcuts({
    onFocusSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
    onCycleEngine: handleCycleEngine,
    onCloseTopLayer: handleCloseTopLayer,
    onToggleHelp: () => setIsHelpOpen((prev) => !prev),
    onToggleDrawer: () => setIsDrawerOpen((prev) => !prev),
    onToggleAddModal: () => setIsAddModalOpen((prev) => !prev),
    onToggleCollapse: () => setIsCollapsed((prev) => !prev),
    searchInputRef,
  });

  const handleShortcutsChange = async (newShortcuts: Shortcut[]) => {
    await storageService.setShortcuts(newShortcuts);
    setShortcuts(newShortcuts);
    // 同步更新当前活动组的 shortcuts 列表
    const updatedGroups = shortcutGroups.map((g) =>
      g.id === activeShortcutGroupId ? { ...g, shortcuts: newShortcuts } : g
    );
    setShortcutGroups(updatedGroups);
    await storageService.setShortcutGroups(updatedGroups);
  };

  const handleGroupsChange = async (newGroups: ShortcutGroup[]) => {
    setShortcutGroups(newGroups);
    await storageService.setShortcutGroups(newGroups);
    const activeGroup = newGroups.find((g) => g.id === activeShortcutGroupId) || newGroups[0];
    if (activeGroup) {
      setShortcuts(activeGroup.shortcuts);
    }
  };

  const handleActiveGroupIdChange = async (groupId: string) => {
    setActiveShortcutGroupId(groupId);
    await storageService.setActiveShortcutGroupId(groupId);
    const targetGroup = shortcutGroups.find((g) => g.id === groupId);
    if (targetGroup) {
      setShortcuts(targetGroup.shortcuts);
    }
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
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-stone-700 dark:text-stone-200 transition-all active:scale-95"
            title="键盘快捷键指南 (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
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
            title="外观设置 (e)"
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
        <div ref={searchContainerRef} className="w-full">
          <SearchBar
            appearance={search}
            engineId={engine}
            onEngineChange={handleEngineChange}
            inputRef={searchInputRef}
            onCycleEngine={handleCycleEngine}
            textColor={searchTextColor}
            tone={searchTone}
          />
        </div>

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
              groups={shortcutGroups}
              activeGroupId={activeShortcutGroupId}
              onGroupsChange={handleGroupsChange}
              onActiveGroupIdChange={handleActiveGroupIdChange}
              textColor={textColor}
              shadowProtection={shadowProtection}
              background={background}
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
        {isCollapsed ? '点击时间可展开工作台' : '点击时间进入极简模式'} · 按 <button type="button" onClick={() => setIsHelpOpen(true)} className="underline cursor-pointer hover:opacity-100">?</button> 查看快捷键
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

      {/* Shortcuts Help Modal */}
      <ShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
};

export default App;
