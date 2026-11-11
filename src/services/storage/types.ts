export type AlignStyle = 'left' | 'center' | 'right';
export type BackgroundType = 'material' | 'color' | 'image';
export type BackgroundPosition = 'center' | 'top' | 'bottom';

export interface SearchAppearance {
  align: AlignStyle;
  width: number;
  gap: number;
  transparency: number; // 0 - 100
  blur: number; // 0 - 24
  radius?: number; // 0 - 28, 默认 24
  /** 垂直位置百分比 (C041)：0 贴顶 / 100 贴底 / 50 居中；默认 50，仅无组件时生效 */
  verticalPosition?: number;
}

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  imageId: string;
  imageBlobUrl?: string;
  previewUrl?: string; // 0ms 首屏超轻量微缩预览图 (C029)
  name: string;
  shade: number; // 0 - 85
  blur: number; // 0 - 20
  position: BackgroundPosition;
  /** 启动台背景模糊半径 px (C040)：0 ~ LAUNCHPAD_BLUR_MAX；旧数据缺省按 DEFAULT_LAUNCHPAD_BLUR */
  launchpadBlur?: number;
}

export const LAUNCHPAD_BLUR_MAX = 40;
export const DEFAULT_LAUNCHPAD_BLUR = 30;

export const DEFAULT_SEARCH_POSITION = 50;
export const SEARCH_POSITION_MIN = 0;
export const SEARCH_POSITION_MAX = 100;

export interface Shortcut {
  id: string;
  name: string;
  url: string;
  isFolder?: boolean;
  children?: Shortcut[];
}

export interface ShortcutGroup {
  id: string;
  name: string;
  shortcuts: Shortcut[];
}

export interface LayoutItem {
  instanceId: string;
  typeId: string;
  settings?: Record<string, unknown>;
  span: number;
  order: number;
  visible: boolean;
}

export interface AppSettings {
  search: SearchAppearance;
  engine: string;
  background: BackgroundConfig;
  shortcuts: Shortcut[];
  shortcutGroups?: ShortcutGroup[];
  activeShortcutGroupId?: string;
  layout: LayoutItem[];
}

export const DEFAULT_SEARCH_APPEARANCE: SearchAppearance = {
  align: 'center',
  width: 600,
  gap: 30,
  transparency: 15,
  blur: 12,
  radius: 24,
  verticalPosition: DEFAULT_SEARCH_POSITION,
};

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  type: 'material',
  color: '#C8D8E8',
  imageId: '',
  name: 'paper',
  shade: 35,
  blur: 0,
  position: 'center',
  launchpadBlur: DEFAULT_LAUNCHPAD_BLUR,
};

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'github', name: 'GitHub', url: 'https://github.com/' },
  { id: 'figma', name: 'Figma', url: 'https://figma.com/' },
  { id: 'notion', name: 'Notion', url: 'https://notion.so/' },
  { id: 'linear', name: 'Linear', url: 'https://linear.app/' },
  { id: 'feishu', name: '飞书', url: 'https://feishu.cn/' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
];

export const DEFAULT_SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'group-default',
    name: '主页',
    shortcuts: DEFAULT_SHORTCUTS,
  },
];

export const DEFAULT_LAYOUT: LayoutItem[] = [];
