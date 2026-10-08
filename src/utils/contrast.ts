/**
 * Background geometry and contrast rules based on WCAG sRGB luminance
 */

export const LIGHT_RGB = [255, 255, 255];
export const DARK_RGB = [20, 28, 32];

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

export function chooseFloatingForeground(samples: number[][]): {
  tone: 'light' | 'dark';
  color: string;
} {
  if (!Array.isArray(samples) || !samples.length) {
    return { tone: 'dark', color: '#141c20' };
  }

  const candidates: Array<{ tone: 'light' | 'dark'; color: string; rgb: number[]; coverage: number; average: number }> = [
    { tone: 'light', color: '#ffffff', rgb: LIGHT_RGB, coverage: 0, average: 0 },
    { tone: 'dark', color: '#141c20', rgb: DARK_RGB, coverage: 0, average: 0 },
  ];

  for (const item of candidates) {
    const ratios = samples.map((pixel) => contrastRatio(item.rgb, pixel));
    item.coverage = ratios.filter((value) => value >= 4.5).length / samples.length;
    item.average = ratios.reduce((sum, value) => sum + Math.log(value), 0) / ratios.length;
  }

  candidates.sort((a, b) => b.coverage - a.coverage || b.average - a.average);
  return { tone: candidates[0].tone, color: candidates[0].color };
}
