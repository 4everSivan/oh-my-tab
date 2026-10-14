/**
 * Wallpaper & large blob persistence using native IndexedDB
 */

const DB_NAME = 'oh-my-tab-db';
const DB_VERSION = 1;
const STORE_NAME = 'wallpapers';

export interface WallpaperRecord {
  id: string;
  data: Blob | string;
  name: string;
  type: string;
  updatedAt: number;
}

export class WallpaperStorage {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryStore = new Map<string, WallpaperRecord>();

  /** 以固定版本打开库；失败时清空缓存允许下次重试 */
  private openDatabase(): Promise<IDBDatabase | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private deleteDatabase(): Promise<void> {
    return new Promise((resolve) => {
      // 无论成败都放行：删除失败时后续事务会给出明确错误，不阻塞流程
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }

  private getDB(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        try {
          const db = await this.openDatabase();
          if (!db) return null;
          // 空库自愈（C001）：库已存在但缺 wallpapers 表时，删除重建以恢复建表升级路径
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.close();
            await this.deleteDatabase();
            return await this.openDatabase();
          }
          return db;
        } catch (error) {
          // IndexedDB 受限或打开失败时，平滑降级至 memoryStore (N14)
          this.dbPromise = null;
          return null;
        }
      })();
    }
    return this.dbPromise;
  }

  async saveWallpaper(id: string, data: Blob | string, name = 'custom-wallpaper', type = 'image/png'): Promise<void> {
    const record: WallpaperRecord = {
      id,
      data,
      name,
      type,
      updatedAt: Date.now(),
    };

    const db = await this.getDB();
    if (!db) {
      this.memoryStore.set(id, record);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(record);
      // 严格在事务真正提交完成 (oncomplete) 时 resolve，杜绝事务中止假成功 (N13)
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      request.onerror = () => reject(request.error);
    });
  }

  async getWallpaper(id: string): Promise<WallpaperRecord | null> {
    const db = await this.getDB();
    if (!db) {
      return this.memoryStore.get(id) || null;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async deleteWallpaper(id: string): Promise<void> {
    const db = await this.getDB();
    if (!db) {
      this.memoryStore.delete(id);
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      // 严格在事务真正提交完成 (oncomplete) 时 resolve (N13)
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
      request.onerror = () => reject(request.error);
    });
  }
}

export const wallpaperStorage = new WallpaperStorage();

let activePreloadPromise: Promise<string | null> | null = null;
let preloadedBlobUrl: string | null = null;
let preloadedImageId: string | null = null;

/**
 * 提前触发壁纸从 IndexedDB 加载并异步预解码（C029 启动性能优化）
 * 在 main.tsx 最早阶段（React 挂载前）即刻启动，与组件解析和首帧绘制并发进行
 */
export function kickOffWallpaperPreload(imageId: string): Promise<string | null> {
  if (preloadedImageId === imageId && preloadedBlobUrl) {
    return Promise.resolve(preloadedBlobUrl);
  }
  if (activePreloadPromise && preloadedImageId === imageId) {
    return activePreloadPromise;
  }

  preloadedImageId = imageId;
  activePreloadPromise = (async () => {
    try {
      const record = await wallpaperStorage.getWallpaper(imageId);
      if (!record || !record.data) return null;
      const blob = record.data instanceof Blob ? record.data : new Blob([record.data]);
      const url = URL.createObjectURL(blob);
      preloadedBlobUrl = url;

      // 异步光栅化解码，防止大图上屏时主线程微卡
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.src = url;
        if ('decode' in img) {
          img.decode().catch((err) => {
            console.debug('[Wallpaper] pre-decode skipped:', err);
          });
        }
      }
      return url;
    } catch (e) {
      console.debug('[Wallpaper] kickOffWallpaperPreload failed:', e);
      return null;
    }
  })();

  return activePreloadPromise;
}

/**
 * 获取当前已预加载的 Blob URL（若有）
 */
export function getPreloadedWallpaper(): string | null {
  return preloadedBlobUrl;
}

