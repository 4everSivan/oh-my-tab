import {
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
} from './types';
import { chromeStorageAdapter, IStorageAdapter } from './chromeStorage';
import { wallpaperStorage, WallpaperStorage } from './wallpaper';

const STORAGE_KEYS = {
  CLOCK: 'settings.clock',
  SEARCH: 'settings.search',
  ENGINE: 'settings.engine',
  BACKGROUND: 'settings.background',
  SHORTCUTS: 'settings.shortcuts',
  SHORTCUT_GROUPS: 'settings.shortcutGroups',
  ACTIVE_SHORTCUT_GROUP_ID: 'settings.activeShortcutGroupId',
  LAYOUT: 'settings.layout',
  SHORTCUT_KEYS_ENABLED: 'settings.shortcutKeysEnabled',
  WIDGET_CONTENT_PREFIX: 'widgets/',
};

export const BOOT_CACHE_KEY = 'oh_my_tab_boot_cache';

export interface BootCache {
  clock?: ClockAppearance;
  search?: SearchAppearance;
  engine?: string;
  background?: BackgroundConfig;
  shortcuts?: Shortcut[];
  shortcutGroups?: ShortcutGroup[];
  activeShortcutGroupId?: string;
  layout?: LayoutItem[];
  shortcutKeysEnabled?: boolean;
  savedAt?: number;
}

/**
 * 剥离会话级派生字段 (C001, C032)：imageBlobUrl 刷新后必然死链，不得写入存储或启动快照；
 * 读取旧数据时同样剥离，避免首帧优先渲染死链而跳过 previewUrl 缩略图
 */
export function toPersistedBackground(bg: BackgroundConfig): BackgroundConfig {
  if (!bg || typeof bg !== 'object' || !('imageBlobUrl' in bg)) return bg;
  const persisted = { ...bg };
  delete persisted.imageBlobUrl;
  return persisted;
}

export function getBootCache(): BootCache | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BOOT_CACHE_KEY);
    const boot: BootCache | null = raw ? JSON.parse(raw) : null;
    if (boot?.background) boot.background = toPersistedBackground(boot.background);
    return boot;
  } catch {
    return null;
  }
}

export function updateBootCache(patch: Partial<BootCache>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const current = getBootCache() || {};
    const updated: BootCache = { ...current, ...patch, savedAt: Date.now() };
    localStorage.setItem(BOOT_CACHE_KEY, JSON.stringify(updated));
  } catch {
    // 忽略 localStorage 限额等异常
  }
}

class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const res = this.queue.then(task, task);
    this.queue = res.then(() => {}, () => {});
    return res;
  }
}

export class StorageService {
  private mutex = new AsyncMutex();

  constructor(
    private adapter: IStorageAdapter = chromeStorageAdapter,
    public wallpaper: WallpaperStorage = wallpaperStorage
  ) {}

  /**
   * 并行批量拉取所有核心配置，大幅降低扩展 IPC 往返延迟并同步刷新启动快照 (C015)
   */
  async loadAllSettings(): Promise<{
    clock: ClockAppearance;
    search: SearchAppearance;
    engine: string;
    background: BackgroundConfig;
    shortcuts: Shortcut[];
    shortcutGroups: ShortcutGroup[];
    activeShortcutGroupId: string;
    layout: LayoutItem[];
    shortcutKeysEnabled: boolean;
  }> {
    const [clock, search, engine, background, shortcuts, shortcutGroups, activeShortcutGroupId, layout, shortcutKeysEnabled] = await Promise.all([
      this.getClock(),
      this.getSearch(),
      this.getEngine(),
      this.getBackground(),
      this.getShortcuts(),
      this.getShortcutGroups(),
      this.getActiveShortcutGroupId(),
      this.getLayout(),
      this.getShortcutKeysEnabled(),
    ]);

    updateBootCache({ clock, search, engine, background, shortcuts, shortcutGroups, activeShortcutGroupId, layout, shortcutKeysEnabled });
    return { clock, search, engine, background, shortcuts, shortcutGroups, activeShortcutGroupId, layout, shortcutKeysEnabled };
  }

  /**
   * 监听跨标签/跨窗口设置变更并广播多播 (N01)
   */
  onSettingsChanged(callback: (key: string, newValue: unknown) => void): () => void {
    if (!this.adapter.onChanged) return () => {};
    return this.adapter.onChanged((changes) => {
      for (const [key, change] of Object.entries(changes)) {
        if (key === STORAGE_KEYS.CLOCK) updateBootCache({ clock: change.newValue as ClockAppearance });
        else if (key === STORAGE_KEYS.SEARCH) updateBootCache({ search: change.newValue as SearchAppearance });
        else if (key === STORAGE_KEYS.ENGINE) updateBootCache({ engine: change.newValue as string });
        else if (key === STORAGE_KEYS.BACKGROUND) {
          const background = toPersistedBackground(change.newValue as BackgroundConfig);
          updateBootCache({ background });
          callback(key, background);
          continue;
        }
        else if (key === STORAGE_KEYS.SHORTCUTS) updateBootCache({ shortcuts: change.newValue as Shortcut[] });
        else if (key === STORAGE_KEYS.SHORTCUT_GROUPS) updateBootCache({ shortcutGroups: change.newValue as ShortcutGroup[] });
        else if (key === STORAGE_KEYS.ACTIVE_SHORTCUT_GROUP_ID) updateBootCache({ activeShortcutGroupId: change.newValue as string });
        else if (key === STORAGE_KEYS.LAYOUT) updateBootCache({ layout: change.newValue as LayoutItem[] });
        else if (key === STORAGE_KEYS.SHORTCUT_KEYS_ENABLED) updateBootCache({ shortcutKeysEnabled: change.newValue as boolean });

        callback(key, change.newValue);
      }
    });
  }

  // Clock
  async getClock(): Promise<ClockAppearance> {
    return this.adapter.get<ClockAppearance>(STORAGE_KEYS.CLOCK, DEFAULT_CLOCK_APPEARANCE);
  }

  async setClock(clock: Partial<ClockAppearance>): Promise<ClockAppearance> {
    return this.mutex.run(async () => {
      const current = await this.getClock();
      const updated: ClockAppearance = { ...current, ...clock };
      await this.adapter.set(STORAGE_KEYS.CLOCK, updated);
      updateBootCache({ clock: updated });
      return updated;
    });
  }

  async resetClock(): Promise<ClockAppearance> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.CLOCK, DEFAULT_CLOCK_APPEARANCE);
      updateBootCache({ clock: DEFAULT_CLOCK_APPEARANCE });
      return DEFAULT_CLOCK_APPEARANCE;
    });
  }

  // Search
  async getSearch(): Promise<SearchAppearance> {
    return this.adapter.get<SearchAppearance>(STORAGE_KEYS.SEARCH, DEFAULT_SEARCH_APPEARANCE);
  }

  async setSearch(search: Partial<SearchAppearance>): Promise<SearchAppearance> {
    return this.mutex.run(async () => {
      const current = await this.getSearch();
      const updated: SearchAppearance = { ...current, ...search };
      await this.adapter.set(STORAGE_KEYS.SEARCH, updated);
      updateBootCache({ search: updated });
      return updated;
    });
  }

  async resetSearch(): Promise<SearchAppearance> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.SEARCH, DEFAULT_SEARCH_APPEARANCE);
      updateBootCache({ search: DEFAULT_SEARCH_APPEARANCE });
      return DEFAULT_SEARCH_APPEARANCE;
    });
  }

  // Engine
  async getEngine(): Promise<string> {
    return this.adapter.get<string>(STORAGE_KEYS.ENGINE, 'google');
  }

  async setEngine(engine: string): Promise<void> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.ENGINE, engine);
      updateBootCache({ engine });
    });
  }

  // Background
  async getBackground(): Promise<BackgroundConfig> {
    const background = await this.adapter.get<BackgroundConfig>(STORAGE_KEYS.BACKGROUND, DEFAULT_BACKGROUND_CONFIG);
    return toPersistedBackground(background);
  }

  async setBackground(bg: Partial<BackgroundConfig>): Promise<BackgroundConfig> {
    return this.mutex.run(async () => {
      const current = await this.getBackground();
      // 返回值保留调用方传入的会话 Blob URL 供本页渲染，落盘与启动快照只写持久化事实
      const updated: BackgroundConfig = { ...current, ...bg };
      const persisted = toPersistedBackground(updated);
      await this.adapter.set(STORAGE_KEYS.BACKGROUND, persisted);
      updateBootCache({ background: persisted });
      return updated;
    });
  }

  async resetBackground(): Promise<BackgroundConfig> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.BACKGROUND, DEFAULT_BACKGROUND_CONFIG);
      updateBootCache({ background: DEFAULT_BACKGROUND_CONFIG });
      return DEFAULT_BACKGROUND_CONFIG;
    });
  }

  // Shortcuts
  async getShortcuts(): Promise<Shortcut[]> {
    return this.adapter.get<Shortcut[]>(STORAGE_KEYS.SHORTCUTS, DEFAULT_SHORTCUTS);
  }

  async setShortcuts(shortcuts: Shortcut[]): Promise<void> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.SHORTCUTS, shortcuts);
      updateBootCache({ shortcuts });
    });
  }

  // Shortcut Groups (T15)
  async getShortcutGroups(): Promise<ShortcutGroup[]> {
    const groups = await this.adapter.get<ShortcutGroup[] | null>(STORAGE_KEYS.SHORTCUT_GROUPS, null);
    if (groups && Array.isArray(groups) && groups.length > 0) {
      return groups;
    }
    // 向后兼容迁移：若尚未保存过分组，将既有 shortcuts 列表包装为默认主页分组
    const legacyShortcuts = await this.getShortcuts();
    const defaultGroups: ShortcutGroup[] =
      legacyShortcuts && legacyShortcuts.length > 0
        ? [
            {
              id: 'group-default',
              name: '主页',
              shortcuts: legacyShortcuts,
            },
          ]
        : DEFAULT_SHORTCUT_GROUPS;
    return defaultGroups;
  }

  async setShortcutGroups(groups: ShortcutGroup[]): Promise<void> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.SHORTCUT_GROUPS, groups);
      updateBootCache({ shortcutGroups: groups });
      // 保持 legacy shortcuts 键与活动分组同步，确保向下兼容
      if (groups.length > 0) {
        const activeId = await this.getActiveShortcutGroupId();
        const activeGroup = groups.find((g) => g.id === activeId) || groups[0];
        await this.adapter.set(STORAGE_KEYS.SHORTCUTS, activeGroup.shortcuts);
        updateBootCache({ shortcuts: activeGroup.shortcuts });
      }
    });
  }

  async getActiveShortcutGroupId(): Promise<string> {
    return this.adapter.get<string>(STORAGE_KEYS.ACTIVE_SHORTCUT_GROUP_ID, 'group-default');
  }

  async setActiveShortcutGroupId(groupId: string): Promise<void> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.ACTIVE_SHORTCUT_GROUP_ID, groupId);
      updateBootCache({ activeShortcutGroupId: groupId });
    });
  }

  // Layout
  async getLayout(): Promise<LayoutItem[]> {
    return this.adapter.get<LayoutItem[]>(STORAGE_KEYS.LAYOUT, DEFAULT_LAYOUT);
  }

  async setLayout(layout: LayoutItem[]): Promise<void> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.LAYOUT, layout);
      updateBootCache({ layout });
    });
  }

  // Namespaced Widget Content: widgets/<instanceId>/content
  async getWidgetContent<T>(instanceId: string, fallback: T): Promise<T> {
    const key = `${STORAGE_KEYS.WIDGET_CONTENT_PREFIX}${instanceId}/content`;
    return this.adapter.get<T>(key, fallback);
  }

  async setWidgetContent<T>(instanceId: string, content: T): Promise<void> {
    const key = `${STORAGE_KEYS.WIDGET_CONTENT_PREFIX}${instanceId}/content`;
    await this.adapter.set(key, content);
  }

  async removeWidgetContent(instanceId: string): Promise<void> {
    const key = `${STORAGE_KEYS.WIDGET_CONTENT_PREFIX}${instanceId}/content`;
    await this.adapter.remove(key);
  }

  // Shortcut Keys Enabled (T16)
  async getShortcutKeysEnabled(): Promise<boolean> {
    return this.adapter.get<boolean>(STORAGE_KEYS.SHORTCUT_KEYS_ENABLED, true);
  }

  async setShortcutKeysEnabled(enabled: boolean): Promise<boolean> {
    return this.mutex.run(async () => {
      await this.adapter.set(STORAGE_KEYS.SHORTCUT_KEYS_ENABLED, enabled);
      updateBootCache({ shortcutKeysEnabled: enabled });
      return enabled;
    });
  }
}

export const storageService = new StorageService();

export * from './types';
export * from './chromeStorage';
export * from './wallpaper';
