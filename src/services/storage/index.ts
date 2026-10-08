import {
  ClockAppearance,
  SearchAppearance,
  BackgroundConfig,
  Shortcut,
  LayoutItem,
  DEFAULT_CLOCK_APPEARANCE,
  DEFAULT_SEARCH_APPEARANCE,
  DEFAULT_BACKGROUND_CONFIG,
  DEFAULT_SHORTCUTS,
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
  LAYOUT: 'settings.layout',
  WIDGET_CONTENT_PREFIX: 'widgets/',
};

export class StorageService {
  constructor(
    private adapter: IStorageAdapter = chromeStorageAdapter,
    public wallpaper: WallpaperStorage = wallpaperStorage
  ) {}

  // Clock
  async getClock(): Promise<ClockAppearance> {
    return this.adapter.get<ClockAppearance>(STORAGE_KEYS.CLOCK, DEFAULT_CLOCK_APPEARANCE);
  }

  async setClock(clock: Partial<ClockAppearance>): Promise<ClockAppearance> {
    const current = await this.getClock();
    const updated: ClockAppearance = { ...current, ...clock };
    await this.adapter.set(STORAGE_KEYS.CLOCK, updated);
    return updated;
  }

  async resetClock(): Promise<ClockAppearance> {
    await this.adapter.set(STORAGE_KEYS.CLOCK, DEFAULT_CLOCK_APPEARANCE);
    return DEFAULT_CLOCK_APPEARANCE;
  }

  // Search
  async getSearch(): Promise<SearchAppearance> {
    return this.adapter.get<SearchAppearance>(STORAGE_KEYS.SEARCH, DEFAULT_SEARCH_APPEARANCE);
  }

  async setSearch(search: Partial<SearchAppearance>): Promise<SearchAppearance> {
    const current = await this.getSearch();
    const updated: SearchAppearance = { ...current, ...search };
    await this.adapter.set(STORAGE_KEYS.SEARCH, updated);
    return updated;
  }

  async resetSearch(): Promise<SearchAppearance> {
    await this.adapter.set(STORAGE_KEYS.SEARCH, DEFAULT_SEARCH_APPEARANCE);
    return DEFAULT_SEARCH_APPEARANCE;
  }

  // Engine
  async getEngine(): Promise<string> {
    return this.adapter.get<string>(STORAGE_KEYS.ENGINE, 'google');
  }

  async setEngine(engine: string): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.ENGINE, engine);
  }

  // Background
  async getBackground(): Promise<BackgroundConfig> {
    return this.adapter.get<BackgroundConfig>(STORAGE_KEYS.BACKGROUND, DEFAULT_BACKGROUND_CONFIG);
  }

  async setBackground(bg: Partial<BackgroundConfig>): Promise<BackgroundConfig> {
    const current = await this.getBackground();
    const updated: BackgroundConfig = { ...current, ...bg };
    await this.adapter.set(STORAGE_KEYS.BACKGROUND, updated);
    return updated;
  }

  async resetBackground(): Promise<BackgroundConfig> {
    await this.adapter.set(STORAGE_KEYS.BACKGROUND, DEFAULT_BACKGROUND_CONFIG);
    return DEFAULT_BACKGROUND_CONFIG;
  }

  // Shortcuts
  async getShortcuts(): Promise<Shortcut[]> {
    return this.adapter.get<Shortcut[]>(STORAGE_KEYS.SHORTCUTS, DEFAULT_SHORTCUTS);
  }

  async setShortcuts(shortcuts: Shortcut[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.SHORTCUTS, shortcuts);
  }

  // Layout
  async getLayout(): Promise<LayoutItem[]> {
    return this.adapter.get<LayoutItem[]>(STORAGE_KEYS.LAYOUT, DEFAULT_LAYOUT);
  }

  async setLayout(layout: LayoutItem[]): Promise<void> {
    await this.adapter.set(STORAGE_KEYS.LAYOUT, layout);
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
}

export const storageService = new StorageService();

export * from './types';
export * from './chromeStorage';
export * from './wallpaper';
