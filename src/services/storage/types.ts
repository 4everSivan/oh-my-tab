export type FontStyle = 'modern' | 'mono' | 'serif';
export type AlignStyle = 'left' | 'center' | 'right';
export type ShadowStyle = 'none' | 'soft';
export type BackgroundType = 'material' | 'color' | 'image';
export type BackgroundPosition = 'center' | 'top' | 'bottom';

export interface ClockAppearance {
  font: FontStyle;
  size: number;
  weight: number;
  align: AlignStyle;
  top: number;
  shadow: ShadowStyle;
  showDate: boolean;
  showSeconds: boolean;
}

export interface SearchAppearance {
  align: AlignStyle;
  width: number;
  gap: number;
  transparency: number; // 0 - 100
  blur: number; // 0 - 24
}

export interface BackgroundConfig {
  type: BackgroundType;
  color: string;
  imageId: string;
  imageBlobUrl?: string;
  name: string;
  shade: number; // 0 - 85
  blur: number; // 0 - 20
  position: BackgroundPosition;
}

export interface Shortcut {
  id: string;
  name: string;
  url: string;
}

export interface LayoutItem {
  instanceId: string;
  typeId: string;
  settings?: Record<string, any>;
  span: number;
  order: number;
  visible: boolean;
}

export interface AppSettings {
  clock: ClockAppearance;
  search: SearchAppearance;
  engine: string;
  background: BackgroundConfig;
  shortcuts: Shortcut[];
  layout: LayoutItem[];
}

export const DEFAULT_CLOCK_APPEARANCE: ClockAppearance = {
  font: 'modern',
  size: 96,
  weight: 400,
  align: 'center',
  top: 56,
  shadow: 'none',
  showDate: true,
  showSeconds: false,
};

export const DEFAULT_SEARCH_APPEARANCE: SearchAppearance = {
  align: 'center',
  width: 600,
  gap: 30,
  transparency: 15,
  blur: 12,
};

export const DEFAULT_BACKGROUND_CONFIG: BackgroundConfig = {
  type: 'material',
  color: '#C8D8E8',
  imageId: '',
  name: 'paper',
  shade: 35,
  blur: 0,
  position: 'center',
};

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: 'github', name: 'GitHub', url: 'https://github.com/' },
  { id: 'figma', name: 'Figma', url: 'https://figma.com/' },
  { id: 'notion', name: 'Notion', url: 'https://notion.so/' },
  { id: 'linear', name: 'Linear', url: 'https://linear.app/' },
  { id: 'feishu', name: '飞书', url: 'https://feishu.cn/' },
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/' },
];

export const DEFAULT_LAYOUT: LayoutItem[] = [];
