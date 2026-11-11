/**
 * 搜索下拉面板可读性（C040，@topic: EntryNavigation）。
 *
 * 联想面板与引擎菜单此前直接沿用搜索框的「背景透明度」并写死深灰字色：
 * 搜索框调得越透明，面板越接近透明；压在深色或花哨壁纸上时深灰小字无法辨认。
 * 这里把面板外观与搜索框的透明度设置解耦——底色跟随当前字色取同向色，
 * 并对不透明度与模糊半径设下限，保证任意壁纸与任意搜索框设置下文字对比度达标。
 */

export type InkTone = 'light' | 'dark';

/** 面板底色不透明度下限：低于它时壁纸细节会穿透到文字后方 */
export const PANEL_MIN_ALPHA = 0.9;
/** 面板背景模糊下限 px：把穿透的壁纸细节抹平成色块 */
export const PANEL_MIN_BLUR = 16;

export interface SearchPanelStyle {
  backgroundColor: string;
  backdropFilter: string;
  borderColor: string;
  /** 候选文字墨色 */
  textColor: string;
  /** 行首图标等次要元素的墨色 */
  mutedColor: string;
  /** 键盘选中行 / 当前引擎行的底色 */
  activeRowColor: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(value, 0), 1);
}

/**
 * @param tone 搜索区自适应取色的墨色：'light' 表示浅字（背景偏深），'dark' 表示深字（背景偏浅）
 * @param surfaceAlpha 搜索框自身底色不透明度（1 - 透明度设置）
 * @param blurPx 搜索框背景模糊设置
 */
export function resolveSearchPanelStyle(
  tone: InkTone,
  surfaceAlpha: number,
  blurPx: number
): SearchPanelStyle {
  const alpha = Math.max(clamp01(surfaceAlpha), PANEL_MIN_ALPHA);
  const blur = Math.max(Number.isFinite(blurPx) ? blurPx : 0, PANEL_MIN_BLUR);
  const backdropFilter = `blur(${blur}px) saturate(1.4)`;

  if (tone === 'light') {
    // 浅字场景：深色玻璃面板 + 近白文字
    return {
      backgroundColor: `rgba(24, 26, 30, ${alpha})`,
      backdropFilter,
      borderColor: 'rgba(255, 255, 255, 0.16)',
      textColor: '#f5f5f4',
      mutedColor: 'rgba(245, 245, 244, 0.6)',
      activeRowColor: 'rgba(255, 255, 255, 0.16)',
    };
  }
  // 深字场景：浅色玻璃面板 + 墨黑文字
  return {
    backgroundColor: `rgba(255, 255, 255, ${alpha})`,
    backdropFilter,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    textColor: '#1c1917',
    mutedColor: 'rgba(28, 25, 23, 0.55)',
    activeRowColor: 'rgba(0, 0, 0, 0.08)',
  };
}

/**
 * 把候选词拆成「已输入部分」与「补全部分」：候选以当前输入开头（忽略大小写与首尾空白）时，
 * 前者按常规字重、后者加粗显示；不以输入开头的候选整体视为补全部分。
 */
export function splitSuggestionText(
  text: string,
  typedQuery: string
): { typed: string; completion: string } {
  const typed = typedQuery.trim();
  if (typed && text.toLowerCase().startsWith(typed.toLowerCase())) {
    return { typed: text.slice(0, typed.length), completion: text.slice(typed.length) };
  }
  return { typed: '', completion: text };
}
