/**
 * Background geometry and contrast rules based on WCAG sRGB luminance
 */

export const LIGHT_RGB: [number, number, number] = [255, 255, 255];
export const DARK_RGB: [number, number, number] = [20, 28, 32];

export function parseHex(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    return [245, 244, 239]; // Default soft background fallback
  }
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function luminance(rgb: [number, number, number] | number[]): number {
  const linear = rgb.map((value) => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function contrastRatio(
  a: [number, number, number] | number[],
  b: [number, number, number] | number[]
): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function blend(
  background: [number, number, number] | number[],
  overlay: [number, number, number] | number[],
  opacity: number
): [number, number, number] {
  return [
    Math.round(background[0] * (1 - opacity) + overlay[0] * opacity),
    Math.round(background[1] * (1 - opacity) + overlay[1] * opacity),
    Math.round(background[2] * (1 - opacity) + overlay[2] * opacity),
  ];
}

/**
 * Match CSS background-size: cover, centered horizontally and vertically positioned.
 */
export function coverRect(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  position: 'center' | 'top' | 'bottom' = 'center'
): { x: number; y: number; width: number; height: number } {
  if (
    ![imageWidth, imageHeight, frameWidth, frameHeight].every(
      (n) => Number.isFinite(n) && n > 0
    )
  ) {
    throw new RangeError('Invalid image or frame size');
  }
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (frameWidth - width) / 2,
    y: position === 'top' ? 0 : (frameHeight - height) * (position === 'bottom' ? 1 : 0.5),
    width,
    height,
  };
}

export interface FloatingForegroundResult {
  tone: 'light' | 'dark';
  color: string;
  minContrast: number;
  shadowProtection: string;
}

export function chooseFloatingForegroundWithProtection(samples: number[][]): FloatingForegroundResult {
  if (!Array.isArray(samples) || !samples.length) {
    return {
      tone: 'dark',
      color: '#141c20',
      minContrast: 1,
      shadowProtection: 'none',
    };
  }

  const candidates: Array<{
    tone: 'light' | 'dark';
    color: string;
    rgb: [number, number, number];
    coverage: number;
    average: number;
    minContrast: number;
  }> = [
    { tone: 'light', color: '#ffffff', rgb: LIGHT_RGB, coverage: 0, average: 0, minContrast: Infinity },
    { tone: 'dark', color: '#141c20', rgb: DARK_RGB, coverage: 0, average: 0, minContrast: Infinity },
  ];

  for (const item of candidates) {
    const ratios = samples.map((pixel) => contrastRatio(item.rgb, pixel));
    item.coverage = ratios.filter((value) => value >= 4.5).length / samples.length;
    item.average = ratios.reduce((sum, value) => sum + Math.log(value), 0) / ratios.length;
    item.minContrast = ratios.reduce((lowest, value) => Math.min(lowest, value), Infinity);
  }

  candidates.sort((a, b) => b.coverage - a.coverage || b.average - a.average);
  const best = candidates[0];

  // If contrast is below the safe threshold of 4.5:1, provide adaptive shadow protection halo
  let shadowProtection = 'none';
  if (best.minContrast < 4.5) {
    if (best.tone === 'light') {
      shadowProtection = '0 2px 14px rgba(0, 0, 0, 0.55), 0 0 2px rgba(0, 0, 0, 0.7)';
    } else {
      shadowProtection = '0 2px 14px rgba(255, 255, 255, 0.75), 0 0 2px rgba(255, 255, 255, 0.9)';
    }
  }

  return {
    tone: best.tone,
    color: best.color,
    minContrast: best.minContrast,
    shadowProtection,
  };
}

export function chooseFloatingForeground(samples: number[][]): {
  tone: 'light' | 'dark';
  color: string;
} {
  const result = chooseFloatingForegroundWithProtection(samples);
  return { tone: result.tone, color: result.color };
}

/**
 * 搜索框文本对比度选取算法 (C014)
 * 搜索文字保持不透明，其所在的搜索框表面与底层壁纸样本按透明度 (transparency) 进行混合，
 * 然后根据合成后的有效亮度自适应选取高对比度的浅色（纯白）或深色（墨黑）墨水。
 */
export function chooseSearchForegroundWithProtection(
  samples: number[][],
  surface: [number, number, number] = LIGHT_RGB,
  transparency: number = 15
): FloatingForegroundResult {
  const alpha = 1 - Math.max(0, Math.min(100, transparency)) / 100;
  if (!Array.isArray(samples) || !samples.length) {
    return alpha >= 0.5
      ? chooseFloatingForegroundWithProtection([surface])
      : chooseFloatingForegroundWithProtection([]);
  }
  const blendedSamples = samples.map((pixel) => blend(pixel, surface, alpha));
  return chooseFloatingForegroundWithProtection(blendedSamples);
}

