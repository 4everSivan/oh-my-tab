import { useState, useEffect, useRef } from 'react';
import { BackgroundConfig, SearchAppearance } from '../services/storage/types';
import {
  parseHex,
  blend,
  coverRect,
  chooseSearchForegroundWithProtection,
  LIGHT_RGB,
} from '../utils/contrast';
import { WallpaperContrastResult } from './useWallpaperContrast';

export function computeInitialSearchContrast(
  background: BackgroundConfig,
  search: SearchAppearance
): WallpaperContrastResult {
  const transparency = search?.transparency ?? 15;

  if (background.type === 'material') {
    const baseRgb: [number, number, number] =
      background.name === 'dark'
        ? [28, 25, 23]
        : background.name === 'blue'
        ? [232, 238, 245]
        : [245, 244, 239];
    const res = chooseSearchForegroundWithProtection([baseRgb], LIGHT_RGB, transparency);
    return {
      textColor: res.color,
      tone: res.tone,
      contrast: res.minContrast,
      shadowProtection: res.shadowProtection,
    };
  }

  const baseRgb = parseHex(background.color || '#f5f4ef');
  const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
  const res = chooseSearchForegroundWithProtection([shadedRgb], LIGHT_RGB, transparency);
  return {
    textColor: res.color,
    tone: res.tone,
    contrast: res.minContrast,
    shadowProtection: res.shadowProtection,
  };
}

/**
 * 搜索框自适应色彩与对比度 Hook (C014)
 * 结合底层壁纸几何采样与搜索框自身 transparency 透明度，
 * 精准计算混合后的表面亮度，自适应选取最高可读性的深浅字色及光标色。
 */
export function useSearchContrast(
  background: BackgroundConfig,
  search: SearchAppearance,
  targetRef?: React.RefObject<HTMLElement | null>
): WallpaperContrastResult {
  const [contrastResult, setContrastResult] = useState<WallpaperContrastResult>(() =>
    computeInitialSearchContrast(background, search)
  );

  const samplingRef = useRef(false);

  useEffect(() => {
    let active = true;
    const transparency = search?.transparency ?? 15;

    // 1. Material preset handling
    if (background.type === 'material') {
      const baseRgb: [number, number, number] =
        background.name === 'dark'
          ? [28, 25, 23]
          : background.name === 'blue'
          ? [232, 238, 245]
          : [245, 244, 239];
      const res = chooseSearchForegroundWithProtection([baseRgb], LIGHT_RGB, transparency);
      setContrastResult({
        textColor: res.color,
        tone: res.tone,
        contrast: res.minContrast,
        shadowProtection: res.shadowProtection,
      });
      return;
    }

    // 2. Solid color handling
    if (background.type === 'color') {
      const baseRgb = parseHex(background.color || '#f5f4ef');
      const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
      const res = chooseSearchForegroundWithProtection([shadedRgb], LIGHT_RGB, transparency);
      setContrastResult({
        textColor: res.color,
        tone: res.tone,
        contrast: res.minContrast,
        shadowProtection: res.shadowProtection,
      });
      return;
    }

    // 3. Custom Image Wallpaper Handling with Offscreen Canvas Sampling
    if (background.type === 'image' && background.imageBlobUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const performSampling = () => {
        if (!active || samplingRef.current) return;
        samplingRef.current = true;

        try {
          const frameWidth = window.innerWidth || 1280;
          const frameHeight = window.innerHeight || 800;
          const scale = Math.min(1, 384 / Math.max(frameWidth, frameHeight));

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.ceil(frameWidth * scale));
          canvas.height = Math.max(1, Math.ceil(frameHeight * scale));

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            samplingRef.current = false;
            return;
          }

          // Base fill
          ctx.fillStyle = background.color || '#f5f4ef';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Render image with coverRect, position, and blur
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

          // Apply shade overlay
          if (background.shade && background.shade > 0) {
            ctx.fillStyle = '#000000';
            ctx.globalAlpha = background.shade / 100;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1.0;
          }

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imgData.data;

          // Determine bounding sampling area for search bar
          let left = 0;
          let right = canvas.width;
          let top = 0;
          let bottom = canvas.height;

          if (targetRef?.current) {
            const rect = targetRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              left = Math.max(0, Math.floor(rect.left * scale));
              right = Math.min(canvas.width, Math.ceil(rect.right * scale));
              top = Math.max(0, Math.floor(rect.top * scale));
              bottom = Math.min(canvas.height, Math.ceil(rect.bottom * scale));
            }
          } else {
            // Default search area zone (middle horizontal 60%, vertical 20% ~ 45%)
            left = Math.floor(canvas.width * 0.2);
            right = Math.ceil(canvas.width * 0.8);
            top = Math.floor(canvas.height * 0.2);
            bottom = Math.ceil(canvas.height * 0.45);
          }

          const samples: number[][] = [];
          const stepX = Math.max(1, Math.floor((right - left) / 40));
          const stepY = Math.max(1, Math.floor((bottom - top) / 30));

          for (let y = top; y < bottom; y += stepY) {
            for (let x = left; x < right; x += stepX) {
              const idx = (y * canvas.width + x) * 4;
              samples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]]);
            }
          }

          const res = chooseSearchForegroundWithProtection(samples, LIGHT_RGB, transparency);
          if (active) {
            setContrastResult({
              textColor: res.color,
              tone: res.tone,
              contrast: res.minContrast,
              shadowProtection: res.shadowProtection,
            });
          }
        } catch {
          // Fallback on sampling failure
          const baseRgb = parseHex(background.color || '#f5f4ef');
          const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
          const fallbackRes = chooseSearchForegroundWithProtection([shadedRgb], LIGHT_RGB, transparency);
          if (active) {
            setContrastResult({
              textColor: fallbackRes.color,
              tone: fallbackRes.tone,
              contrast: fallbackRes.minContrast,
              shadowProtection: fallbackRes.shadowProtection,
            });
          }
        } finally {
          samplingRef.current = false;
        }
      };

      img.onload = () => {
        performSampling();
      };

      img.onerror = () => {
        if (active) {
          const fallbackRes = chooseSearchForegroundWithProtection([[20, 28, 32]], LIGHT_RGB, transparency);
          setContrastResult({
            textColor: fallbackRes.color,
            tone: fallbackRes.tone,
            contrast: fallbackRes.minContrast,
            shadowProtection: 'none',
          });
        }
      };

      img.src = background.imageBlobUrl;

      const handleResize = () => {
        if (img.complete && img.naturalWidth) {
          performSampling();
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        active = false;
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
    targetRef,
  ]);

  return contrastResult;
}
