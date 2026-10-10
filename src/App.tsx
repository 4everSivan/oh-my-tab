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
import { FeedSidebar } from './components/feed/FeedSidebar';
import { feedService, FeedItem, FeedSource } from './services/feed';
import { AddWidgetModal } from './components/widgets/AddWidgetModal';
import { WidgetManifest } from './contract/types';
import { createWidgetInstance } from './contract/widget';
import { planBackgroundRestore } from './utils/background';
// useAdaptiveContrast (C015): 统合原 useWallpaperContrast 与 useSearchContrast 为单管线并清空画布释放 GPU 缓冲
import { useAdaptiveContrast } from './hooks/useAdaptiveContrast';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { SlidersHorizontal, Plus, Keyboard, Bell } from 'lucide-react';

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
  const [shortcutKeysEnabled, setShortcutKeysEnabledState] = useState<boolean>(
    () => boot?.shortcutKeysEnabled ?? true
  );

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFeedSidebarOpen, setIsFeedSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // 独立真实 RSS/Atom/脚本订阅消息与源列表 (T18)
  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [feedSources, setFeedSources] = useState<FeedSource[]>([]);
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(false);
  const unreadCount = feeds.filter((f) => !f.read).length;

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
        shortcutKeysEnabled: skEnabled,
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
      if (skEnabled !== undefined) setShortcutKeysEnabledState(skEnabled);
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

  // 刷新所有订阅源 (T18)
  const handleRefreshFeeds = useCallback(async () => {
    setIsFeedRefreshing(true);
    try {
      const { feeds: updatedFeeds } = await feedService.refreshAllFeeds(true);
      setFeeds(updatedFeeds);
      const updatedSources = await feedService.getSources();
      setFeedSources(updatedSources);
    } catch (e) {
      console.warn('[App] 刷新订阅失败', e);
    } finally {
      setIsFeedRefreshing(false);
    }
  }, []);

  // 订阅源与文章缓存初次加载 (T18)
  useEffect(() => {
    let active = true;
    async function initFeeds() {
      const sources = await feedService.getSources();
      if (!active) return;
      setFeedSources(sources);

      const cached = await feedService.getCachedFeeds();
      if (!active) return;
      if (cached && cached.length > 0) {
        setFeeds(cached);
      } else {
        // 首次启动静默初始化刷新
        handleRefreshFeeds();
      }
    }
    initFeeds();
    return () => {
      active = false;
    };
  }, [handleRefreshFeeds]);

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

  const handleToggleFeedRead = async (id: string) => {
    const updated = await feedService.toggleRead(id);
    setFeeds(updated);
  };

  const handleMarkAllFeedsRead = async () => {
    const updated = await feedService.markAllRead();
    setFeeds(updated);
  };

  const handleAddFeedSource = async (source: Omit<FeedSource, 'id'>) => {
    await feedService.addSource(source);
    const sources = await feedService.getSources();
    setFeedSources(sources);
    handleRefreshFeeds();
  };

  const handleToggleFeedSource = async (id: string, enabled: boolean) => {
    await feedService.toggleSource(id, enabled);
    const sources = await feedService.getSources();
    setFeedSources(sources);
    handleRefreshFeeds();
  };

  const handleDeleteFeedSource = async (id: string) => {
    await feedService.deleteSource(id);
    const sources = await feedService.getSources();
    setFeedSources(sources);
    const cached = await feedService.getCachedFeeds();
    setFeeds(cached);
  };

  const handleResetDefaultSources = async () => {
    const sources = await feedService.resetToDefaultSources();
    setFeedSources(sources);
    handleRefreshFeeds();
  };

  const handleImportOpml = async (xmlText: string) => {
    const { added, sources } = await feedService.importOpml(xmlText);
    setFeedSources(sources);
    handleRefreshFeeds();
    return added;
  };

  const handleExportOpml = async () => {
    const opmlXml = await feedService.exportOpml();
    const blob = new Blob([opmlXml], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oh-my-tab-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpdateShortcutKeysEnabled = async (enabled: boolean) => {
    await storageService.setShortcutKeysEnabled(enabled);
    setShortcutKeysEnabledState(enabled);
  };

  const handleCloseTopLayer = (): boolean => {
    if (isHelpOpen) {
      setIsHelpOpen(false);
      return true;
    }
    if (isFeedSidebarOpen) {
      setIsFeedSidebarOpen(false);
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
    onToggleHelp: () => {
      setIsHelpOpen((prev) => {
        const next = !prev;
        if (next) {
          setIsFeedSidebarOpen(false);
          setIsDrawerOpen(false);
          setIsAddModalOpen(false);
        }
        return next;
      });
    },
    onToggleDrawer: () => {
      setIsDrawerOpen((prev) => {
        const next = !prev;
        if (next) {
          setIsFeedSidebarOpen(false);
          setIsHelpOpen(false);
          setIsAddModalOpen(false);
        }
        return next;
      });
    },
    onToggleFeedSidebar: () => {
      setIsFeedSidebarOpen((prev) => {
        const next = !prev;
        if (next) {
          setIsDrawerOpen(false);
          setIsHelpOpen(false);
          setIsAddModalOpen(false);
        }
        return next;
      });
    },
    onToggleAddModal: () => {
      setIsAddModalOpen((prev) => {
        const next = !prev;
        if (next) {
          setIsFeedSidebarOpen(false);
          setIsDrawerOpen(false);
          setIsHelpOpen(false);
        }
        return next;
      });
    },
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
          {/* 快捷键指南 */}
          <button
            onClick={() => {
              setIsHelpOpen((prev) => !prev);
              setIsAddModalOpen(false);
              setIsFeedSidebarOpen(false);
              setIsDrawerOpen(false);
            }}
            className={`relative group p-2 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-stone-700 dark:text-stone-200 transition-all active:scale-95 cursor-pointer ${
              isHelpOpen ? 'ring-2 ring-stone-400 dark:ring-stone-500 bg-white dark:bg-stone-800' : ''
            }`}
            title="快捷键指南 (?)"
            aria-label="快捷键指南 (?)"
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span className="topbar-tooltip pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-stone-900/90 dark:bg-stone-800/95 text-white dark:text-stone-100 text-[11px] font-medium rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 scale-95 group-hover:scale-100 border border-white/10 flex items-center gap-1.5">
              <span className="tooltip-text">快捷键指南</span>
              <kbd className="px-1 py-0.2 bg-white/20 dark:bg-white/15 rounded text-[9px] font-mono text-stone-200">?</kbd>
            </span>
          </button>
          {/* 添加组件 */}
          <button
            onClick={() => {
              setIsAddModalOpen((prev) => !prev);
              setIsHelpOpen(false);
              setIsFeedSidebarOpen(false);
              setIsDrawerOpen(false);
            }}
            className={`relative group p-2 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-stone-700 dark:text-stone-200 transition-all active:scale-95 cursor-pointer ${
              isAddModalOpen ? 'ring-2 ring-stone-400 dark:ring-stone-500 bg-white dark:bg-stone-800' : ''
            }`}
            title="添加组件 (a)"
            aria-label="添加组件 (a)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="topbar-tooltip pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-stone-900/90 dark:bg-stone-800/95 text-white dark:text-stone-100 text-[11px] font-medium rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 scale-95 group-hover:scale-100 border border-white/10 flex items-center gap-1.5">
              <span className="tooltip-text">添加组件</span>
              <kbd className="px-1 py-0.2 bg-white/20 dark:bg-white/15 rounded text-[9px] font-mono text-stone-200">a</kbd>
            </span>
          </button>
          {/* 独立订阅消息胶囊按钮 (T17) */}
          <button
            onClick={() => {
              setIsFeedSidebarOpen((prev) => !prev);
              setIsDrawerOpen(false);
              setIsHelpOpen(false);
              setIsAddModalOpen(false);
            }}
            className={`relative group p-2 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-stone-700 dark:text-stone-200 transition-all active:scale-95 cursor-pointer ${
              isFeedSidebarOpen ? 'ring-2 ring-stone-400 dark:ring-stone-500 bg-white dark:bg-stone-800' : ''
            }`}
            title={`订阅消息 (${unreadCount} 条未读) (b)`}
            aria-label={`订阅消息 (${unreadCount} 条未读) (b)`}
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="hub-badge absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs animate-pulse">
                {unreadCount}
              </span>
            )}
            <span className="topbar-tooltip pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-stone-900/90 dark:bg-stone-800/95 text-white dark:text-stone-100 text-[11px] font-medium rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 scale-95 group-hover:scale-100 border border-white/10 flex items-center gap-1.5">
              <span className="tooltip-text">订阅消息</span>
              <kbd className="px-1 py-0.2 bg-white/20 dark:bg-white/15 rounded text-[9px] font-mono text-stone-200">b</kbd>
            </span>
          </button>
          {/* 外观设置圆形胶囊按钮 */}
          <button
            onClick={() => {
              setIsDrawerOpen((prev) => !prev);
              setIsFeedSidebarOpen(false);
              setIsHelpOpen(false);
              setIsAddModalOpen(false);
            }}
            className={`relative group p-2 rounded-full bg-white/70 dark:bg-stone-850/70 hover:bg-white dark:hover:bg-stone-800 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-xs text-stone-700 dark:text-stone-200 transition-all active:scale-95 cursor-pointer ${
              isDrawerOpen ? 'ring-2 ring-stone-400 dark:ring-stone-500 bg-white dark:bg-stone-800' : ''
            }`}
            title="外观设置 (e)"
            aria-label="外观设置 (e)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="topbar-tooltip pointer-events-none absolute top-full mt-2 right-0 px-2.5 py-1 bg-stone-900/90 dark:bg-stone-800/95 text-white dark:text-stone-100 text-[11px] font-medium rounded-lg shadow-xl backdrop-blur-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all duration-150 z-50 scale-95 group-hover:scale-100 border border-white/10 flex items-center gap-1.5">
              <span className="tooltip-text">外观设置</span>
              <kbd className="px-1 py-0.2 bg-white/20 dark:bg-white/15 rounded text-[9px] font-mono text-stone-200">e</kbd>
            </span>
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
              shortcutKeysEnabled={shortcutKeysEnabled}
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
        {isCollapsed ? '点击时间可展开工作台' : '点击时间进入极简模式'} · 按 <button type="button" onClick={() => {
          setIsHelpOpen(true);
          setIsDrawerOpen(false);
          setIsFeedSidebarOpen(false);
          setIsAddModalOpen(false);
        }} className="underline cursor-pointer hover:opacity-100">?</button> 查看快捷键
      </footer>

      {/* Appearance Settings Drawer */}
      <AppearanceDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        clock={clock}
        search={search}
        background={background}
        shortcutKeysEnabled={shortcutKeysEnabled}
        onUpdateClock={handleUpdateClock}
        onResetClock={handleResetClock}
        onUpdateSearch={handleUpdateSearch}
        onResetSearch={handleResetSearch}
        onUpdateBackground={handleUpdateBackground}
        onResetBackground={handleResetBackground}
        onUpdateShortcutKeysEnabled={handleUpdateShortcutKeysEnabled}
      />

      {/* Feed Sidebar Drawer (T17 & T18) */}
      <FeedSidebar
        isOpen={isFeedSidebarOpen}
        onClose={() => setIsFeedSidebarOpen(false)}
        feeds={feeds}
        sources={feedSources}
        isRefreshing={isFeedRefreshing}
        onRefresh={handleRefreshFeeds}
        onToggleRead={handleToggleFeedRead}
        onMarkAllRead={handleMarkAllFeedsRead}
        onAddSource={handleAddFeedSource}
        onToggleSource={handleToggleFeedSource}
        onDeleteSource={handleDeleteFeedSource}
        onResetDefaultSources={handleResetDefaultSources}
        onImportOpml={handleImportOpml}
        onExportOpml={handleExportOpml}
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
