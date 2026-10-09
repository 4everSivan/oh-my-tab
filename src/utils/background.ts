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
    },
  };
}
