/**
 * Chrome Storage adapter with local & sync support and fallback
 */

export interface StorageChangeMap {
  [key: string]: { oldValue?: unknown; newValue?: unknown };
}

export interface IStorageAdapter {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  onChanged?(callback: (changes: StorageChangeMap) => void): () => void;
}

export class ChromeStorageAdapter implements IStorageAdapter {
  private isExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;
  private memoryFallback = new Map<string, unknown>();

  async get<T>(key: string, fallback: T): Promise<T> {
    // 若降级内存中存有最新写入（如 localStorage 异常或限额），优先读出降级内存 (N14)
    if (this.memoryFallback.has(key)) {
      return this.memoryFallback.get(key) as T;
    }

    if (this.isExtension) {
      return new Promise<T>((resolve) => {
        chrome.storage.local.get([key], (result) => {
          if (chrome.runtime?.lastError || result[key] === undefined) {
            resolve(fallback);
          } else {
            resolve(result[key]);
          }
        });
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem(key);
        if (item === null) return fallback;
        return JSON.parse(item);
      } catch (err: unknown) {
        console.warn(`[ChromeStorage] localStorage.getItem 解析失败，使用回退值: ${key}`, err);
        return fallback;
      }
    }

    return fallback;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.isExtension) {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [key]: value }, () => {
          if (chrome.runtime?.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        this.memoryFallback.delete(key);
        return;
      } catch (err) {
        // localStorage 超限或被禁用，保留诊断警告并优雅回退至内存存储 (N14)
        console.warn(`[ChromeStorage] localStorage.setItem 失败，回退至内存缓存: ${key}`, err);
      }
    }

    this.memoryFallback.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.memoryFallback.delete(key);

    if (this.isExtension) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.remove([key], () => resolve());
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.warn(`[ChromeStorage] localStorage.removeItem 失败: ${key}`, err);
      }
    }
  }

  async clear(): Promise<void> {
    this.memoryFallback.clear();

    if (this.isExtension) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.clear(() => resolve());
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch (err) {
        console.warn('[ChromeStorage] localStorage.clear 失败', err);
      }
    }
  }

  /**
   * 监听多标签/多窗口存储变更事件，实现状态多播 (N01)
   */
  onChanged(callback: (changes: StorageChangeMap) => void): () => void {
    if (this.isExtension && chrome.storage?.onChanged) {
      const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area === 'local') {
          const mapped: StorageChangeMap = {};
          for (const [k, v] of Object.entries(changes)) {
            mapped[k] = { oldValue: v.oldValue, newValue: v.newValue };
          }
          callback(mapped);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const listener = (e: StorageEvent) => {
        if (e.key) {
          try {
            const oldValue = e.oldValue ? JSON.parse(e.oldValue) : undefined;
            const newValue = e.newValue ? JSON.parse(e.newValue) : undefined;
            callback({ [e.key]: { oldValue, newValue } });
          } catch (err: unknown) {
            console.debug('[ChromeStorage] window.storage 事件反序列化失败:', err);
          }
        }
      };
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    }

    return () => {};
  }
}

export const chromeStorageAdapter = new ChromeStorageAdapter();
