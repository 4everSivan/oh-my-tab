import { useState, useEffect, useRef } from 'react';
import { BackgroundConfig, SearchAppearance } from '../services/storage/types';
import {
  parseHex,
  blend,
  coverRect,
  chooseFloatingForegroundWithProtection,
  chooseSearchForegroundWithProtection,
  FloatingForegroundResult,
  LIGHT_RGB,
} from '../utils/contrast';
import { WallpaperContrastResult } from './useWallpaperContrast';
import { computeInitialSearchContrast } from './useSearchContrast';

export interface UnifiedContrastResult {
  clock: WallpaperContrastResult;
  search: WallpaperContrastResult;
}

export function computeInitialAdaptiveContrast(
  background: BackgroundConfig,
  search: SearchAppearance
): UnifiedContrastResult {
  let clockRes: FloatingForegroundResult;

  if (background.type === 'material') {
    const isDark = background.name === 'dark';
    clockRes = isDark
      ? { tone: 'light', color: '#ffffff', minContrast: 16.8, shadowProtection: 'none' }
      : { tone: 'dark', color: '#141c20', minContrast: 15.6, shadowProtection: 'none' };
  } else {
    const baseRgb = parseHex(background.color || '#f5f4ef');
    const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
    clockRes = chooseFloatingForegroundWithProtection([shadedRgb]);
  }

  const searchRes = computeInitialSearchContrast(background, search);

  return {
    clock: {
      textColor: clockRes.color,
      tone: clockRes.tone,
      contrast: clockRes.minContrast,
      shadowProtection: clockRes.shadowProtection,
    },
    search: searchRes,
  };
}

/**
 * 统合壁纸与组件几何采样管线 Hook (C015)
 * 将时钟与搜索框双重采样合并至单一离线 Canvas 渲染流，
 * 采样完成后即时清空画布尺寸释放 GPU 内存，
 * 窗口 resize 采用 requestAnimationFrame 防抖，杜绝高频内存飙升。
 */
export function useAdaptiveContrast(
  background: BackgroundConfig,
  search: SearchAppearance,
  clockRef?: React.RefObject<HTMLElement | null>,
  searchRef?: React.RefObject<HTMLElement | null>
): UnifiedContrastResult {
  const [result, setResult] = useState<UnifiedContrastResult>(() =>
    computeInitialAdaptiveContrast(background, search)
  );

  const samplingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const transparency = search?.transparency ?? 15;

    // 1. Material preset
    if (background.type === 'material') {
      const isDark = background.name === 'dark';
      const baseRgb: [number, number, number] = isDark
        ? [28, 25, 23]
        : background.name === 'blue'
        ? [232, 238, 245]
        : [245, 244, 239];
      const searchRes = chooseSearchForegroundWithProtection([baseRgb], LIGHT_RGB, transparency);
      setResult({
        clock: {
          textColor: isDark ? '#ffffff' : '#141c20',
          tone: isDark ? 'light' : 'dark',
          contrast: isDark ? 16.8 : 15.6,
          shadowProtection: 'none',
        },
        search: {
          textColor: searchRes.color,
          tone: searchRes.tone,
          contrast: searchRes.minContrast,
          shadowProtection: searchRes.shadowProtection,
        },
      });
      return;
    }

    // 2. Solid color
    if (background.type === 'color') {
      const baseRgb = parseHex(background.color || '#f5f4ef');
      const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
      const clockRes = chooseFloatingForegroundWithProtection([shadedRgb]);
      const searchRes = chooseSearchForegroundWithProtection([shadedRgb], LIGHT_RGB, transparency);
      setResult({
        clock: {
          textColor: clockRes.color,
          tone: clockRes.tone,
          contrast: clockRes.minContrast,
          shadowProtection: clockRes.shadowProtection,
        },
        search: {
          textColor: searchRes.color,
          tone: searchRes.tone,
          contrast: searchRes.minContrast,
          shadowProtection: searchRes.shadowProtection,
        },
      });
      return;
    }

    // 3. Custom Image Wallpaper (Single Canvas pipeline)
    if (background.type === 'image' && background.imageBlobUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const performSampling = () => {
        if (!active || samplingRef.current) return;
        samplingRef.current = true;

        let canvas: HTMLCanvasElement | null = null;
        try {
          const frameWidth = window.innerWidth || 1280;
          const frameHeight = window.innerHeight || 800;
          const scale = Math.min(1, 384 / Math.max(frameWidth, frameHeight));

          canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.ceil(frameWidth * scale));
          canvas.height = Math.max(1, Math.ceil(frameHeight * scale));

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            samplingRef.current = false;
            return;
          }

          ctx.fillStyle = background.color || '#f5f4ef';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const cover = coverRect(
            img.naturalWidth || frameWidth,
            img.naturalHeight || frameHeight,
            frameWidth,
            frameHeight,
            background.position || 'center'
          );

          if (background.blur && background.blur > 0) {
            ctx.filter = `blur(${Math.round(background.blur * scale)}px)`;
          }

          ctx.drawImage(
            img,
            cover.x * scale,
            cover.y * scale,
            cover.width * scale,
            cover.height * scale
          );
          ctx.filter = 'none';

          if (background.shade && background.shade > 0) {
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = background.shade / 100;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
          }

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imgData.data;

          // --- Clock region sampling ---
          let cLeft = Math.floor(canvas.width * 0.2);
          let cRight = Math.ceil(canvas.width * 0.8);
          let cTop = Math.floor(canvas.height * 0.08);
          let cBottom = Math.ceil(canvas.height * 0.35);

          if (clockRef?.current) {
            const rect = clockRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              cLeft = Math.max(0, Math.floor(rect.left * scale));
              cRight = Math.min(canvas.width, Math.ceil(rect.right * scale));
              cTop = Math.max(0, Math.floor(rect.top * scale));
              cBottom = Math.min(canvas.height, Math.ceil(rect.bottom * scale));
            }
          }

          const clockSamples: number[][] = [];
          const cStepX = Math.max(1, Math.floor((cRight - cLeft) / 40));
          const cStepY = Math.max(1, Math.floor((cBottom - cTop) / 30));
          for (let y = cTop; y < cBottom; y += cStepY) {
            for (let x = cLeft; x < cRight; x += cStepX) {
              const idx = (y * canvas.width + x) * 4;
              clockSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
            }
          }
          const clockRes = chooseFloatingForegroundWithProtection(clockSamples);

          // --- Search region sampling ---
          let sLeft = Math.floor(canvas.width * 0.2);
          let sRight = Math.ceil(canvas.width * 0.8);
          let sTop = Math.floor(canvas.height * 0.2);
          let sBottom = Math.ceil(canvas.height * 0.45);

          if (searchRef?.current) {
            const rect = searchRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              sLeft = Math.max(0, Math.floor(rect.left * scale));
              sRight = Math.min(canvas.width, Math.ceil(rect.right * scale));
              sTop = Math.max(0, Math.floor(rect.top * scale));
              sBottom = Math.min(canvas.height, Math.ceil(rect.bottom * scale));
            }
          }

          const searchSamples: number[][] = [];
          const sStepX = Math.max(1, Math.floor((sRight - sLeft) / 40));
          const sStepY = Math.max(1, Math.floor((sBottom - sTop) / 30));
          for (let y = sTop; y < sBottom; y += sStepY) {
            for (let x = sLeft; x < sRight; x += sStepX) {
              const idx = (y * canvas.width + x) * 4;
              searchSamples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
            }
          }
          const searchRes = chooseSearchForegroundWithProtection(searchSamples, LIGHT_RGB, transparency);

          if (active) {
            setResult({
              clock: {
                textColor: clockRes.color,
                tone: clockRes.tone,
                contrast: clockRes.minContrast,
                shadowProtection: clockRes.shadowProtection,
              },
              search: {
                textColor: searchRes.color,
                tone: searchRes.tone,
                contrast: searchRes.minContrast,
                shadowProtection: searchRes.shadowProtection,
              },
            });
          }
        } catch {
          // Fallback to safe math on error
          const baseRgb = parseHex(background.color || '#f5f4ef');
          const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
          const clockFallback = chooseFloatingForegroundWithProtection([shadedRgb]);
          const searchFallback = chooseSearchForegroundWithProtection([shadedRgb], LIGHT_RGB, transparency);
          if (active) {
            setResult({
              clock: {
                textColor: clockFallback.color,
                tone: clockFallback.tone,
                contrast: clockFallback.minContrast,
                shadowProtection: clockFallback.shadowProtection,
              },
              search: {
                textColor: searchFallback.color,
                tone: searchFallback.tone,
                contrast: searchFallback.minContrast,
                shadowProtection: searchFallback.shadowProtection,
              },
            });
          }
        } finally {
          // 关键内存释放：设置 0x0 强制浏览器回收 backing store 像素缓冲 (C015)
          if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
          }
          samplingRef.current = false;
        }
      };

      img.onload = () => {
        performSampling();
      };

      img.onerror = () => {
        if (active) {
          setResult({
            clock: { textColor: '#141c20', tone: 'dark', contrast: 12.0, shadowProtection: 'none' },
            search: { textColor: '#141c20', tone: 'dark', contrast: 12.0, shadowProtection: 'none' },
          });
        }
      };

      img.src = background.imageBlobUrl;

      // 使用 requestAnimationFrame 防抖监听 resize，防止高频触发分配
      let rAFId = 0;
      const handleResize = () => {
        if (rAFId) cancelAnimationFrame(rAFId);
        rAFId = requestAnimationFrame(() => {
          if (img.complete && img.naturalWidth) {
            performSampling();
          }
        });
      };

      window.addEventListener('resize', handleResize);
      return () => {
        active = false;
        if (rAFId) cancelAnimationFrame(rAFId);
        window.removeEventListener('resize', handleResize);
        img.onload = null;
        img.onerror = null;
      };
    }
  }, [
    background.type,
    background.name,
    background.color,
    background.imageBlobUrl,
    background.shade,
    background.blur,
    background.position,
    search.transparency,
    clockRef,
    searchRef,
  ]);

  return result;
}
