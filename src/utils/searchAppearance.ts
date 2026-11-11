import {
  SearchAppearance,
  DEFAULT_SEARCH_POSITION,
  SEARCH_POSITION_MIN,
  SEARCH_POSITION_MAX,
} from '../services/storage/types';

export { DEFAULT_SEARCH_POSITION, SEARCH_POSITION_MIN, SEARCH_POSITION_MAX };

/** 将任意输入取整并钳制到 0–100 的垂直位置百分比 (C041)。 */
export function clampSearchPosition(value: number): number {
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, SEARCH_POSITION_MIN), SEARCH_POSITION_MAX);
}

/**
 * 解析搜索框垂直位置 (C041)：缺失或非有限数回落默认 50%，
 * 越界钳制到 0–100。旧版配置没有该字段时按居中渲染，无需迁移。
 */
export function resolveSearchPosition(
  appearance?: Pick<SearchAppearance, 'verticalPosition'> | null
): number {
  const value = appearance?.verticalPosition;
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SEARCH_POSITION;
  return clampSearchPosition(value);
}
