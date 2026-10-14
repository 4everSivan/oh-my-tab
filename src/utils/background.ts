import { BackgroundConfig } from '../services/storage/types';

/**
 * 壁纸恢复裁决（C001，@topic: DataPersistenceSync）。
 * imageBlobUrl 是 URL.createObjectURL 的会话级派生地址，刷新后必然死链，
 * 不得作为持久化事实；持久化事实是 imageId → IndexedDB Blob 记录。
 */

export type BackgroundRestorePlan =
  /** 非图片背景或无 imageId：配置原样可用 */
  | { kind: 'as-is'; config: BackgroundConfig }
  /** 图片背景且 IndexedDB 有记录：调用方取 Blob 重建 objectURL 后使用 */
  | { kind: 'restore'; config: BackgroundConfig }
  /** 图片背景但记录缺失（存储被清/跨环境）：回退材质，清除死链字段并由调用方回写存储 */
  | { kind: 'fallback'; config: BackgroundConfig };

export function planBackgroundRestore(
  config: BackgroundConfig,
  hasWallpaperRecord: boolean
): BackgroundRestorePlan {
  if (config.type !== 'image' || !config.imageId) {
    return { kind: 'as-is', config };
  }
  if (hasWallpaperRecord) {
    return { kind: 'restore', config };
  }
  // 记录缺失：保留用户色值回退材质，清空 image 字段防止死链再次进入渲染层
  return {
    kind: 'fallback',
    config: {
      ...config,
      type: 'material',
      imageId: '',
      imageBlobUrl: undefined,
      previewUrl: undefined,
    },
  };
}

/**
 * 生成超轻量壁纸微缩预览图 (C029 启动性能优化)
 * 宽/高封顶 240px，输出体积约 4KB~8KB 的 JPEG Data URL，供首帧 0ms 无感直出
 */
export async function generateWallpaperThumbnail(blob: Blob): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = objectUrl;
    });

    const maxDim = 240;
    const origWidth = img.width || maxDim;
    const origHeight = img.height || maxDim;
    const scale = Math.min(1, maxDim / Math.max(origWidth, origHeight));
    const width = Math.max(1, Math.round(origWidth * scale));
    const height = Math.max(1, Math.round(origHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }

    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(objectUrl);
    return canvas.toDataURL('image/jpeg', 0.45);
  } catch (e) {
    console.debug('[Wallpaper] generateWallpaperThumbnail failed:', e);
    return null;
  }
}

