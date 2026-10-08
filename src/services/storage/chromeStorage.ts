/**
 * Chrome Storage adapter with local & sync support and fallback
 */

export interface IStorageAdapter {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class ChromeStorageAdapter implements IStorageAdapter {
  private isExtension = typeof chrome !== 'undefined' && !!chrome.storage?.local;
  private memoryFallback = new Map<string, any>();

  async get<T>(key: string, fallback: T): Promise<T> {
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
      } catch {
        return fallback;
      }
    }

    return this.memoryFallback.has(key) ? this.memoryFallback.get(key) : fallback;
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
        return;
      } catch {
        // Fall through to memory
      }
    }

    this.memoryFallback.set(key, value);
  }

  async remove(key: string): Promise<void> {
    if (this.isExtension) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.remove([key], () => resolve());
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }

    this.memoryFallback.delete(key);
  }

  async clear(): Promise<void> {
    if (this.isExtension) {
      return new Promise<void>((resolve) => {
        chrome.storage.local.clear(() => resolve());
      });
    }

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    }

    this.memoryFallback.clear();
  }
}

export const chromeStorageAdapter = new ChromeStorageAdapter();
