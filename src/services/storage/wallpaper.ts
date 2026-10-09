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
        const db = await this.openDatabase();
        if (!db) return null;
        // 空库自愈（C001）：库已存在但缺 wallpapers 表时，onupgradeneeded 不会再触发
        // （如被无版本 open 的外部脚本创建过），删除重建以恢复建表升级路径
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.close();
          await this.deleteDatabase();
          return this.openDatabase();
        }
        return db;
      })().catch((error) => {
        this.dbPromise = null;
        throw error;
      });
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
      request.onsuccess = () => resolve();
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
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const wallpaperStorage = new WallpaperStorage();
