import { useState, useEffect, useRef } from 'react';
import { BackgroundConfig } from '../services/storage/types';
import {
  parseHex,
  blend,
  coverRect,
  chooseFloatingForegroundWithProtection,
  FloatingForegroundResult,
} from '../utils/contrast';

export interface WallpaperContrastResult {
  textColor: string;
  tone: 'light' | 'dark';
  contrast: number;
  shadowProtection: string;
}

export function useWallpaperContrast(
  background: BackgroundConfig,
  targetRef?: React.RefObject<HTMLElement | null>
): WallpaperContrastResult {
  const [contrastResult, setContrastResult] = useState<WallpaperContrastResult>(() => {
    if (background.type === 'material') {
      return background.name === 'dark'
        ? { textColor: '#ffffff', tone: 'light', contrast: 16.8, shadowProtection: 'none' }
        : { textColor: '#141c20', tone: 'dark', contrast: 15.6, shadowProtection: 'none' };
    }
    const baseRgb = parseHex(background.color || '#f5f4ef');
    const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
    const res = chooseFloatingForegroundWithProtection([shadedRgb]);
    return {
      textColor: res.color,
      tone: res.tone,
      contrast: res.minContrast,
      shadowProtection: res.shadowProtection,
    };
  });

  const samplingRef = useRef(false);

  useEffect(() => {
    let active = true;

    // 1. Material preset handling
    if (background.type === 'material') {
      const isDark = background.name === 'dark';
      setContrastResult({
        textColor: isDark ? '#ffffff' : '#141c20',
        tone: isDark ? 'light' : 'dark',
        contrast: isDark ? 16.8 : 15.6,
        shadowProtection: 'none',
      });
      return;
    }

    // 2. Solid color handling
    if (background.type === 'color') {
      const baseRgb = parseHex(background.color || '#f5f4ef');
      const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
      const res = chooseFloatingForegroundWithProtection([shadedRgb]);
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

          // Determine bounding sampling area
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
            // Default sampling zone: clock and header area (top 10% ~ 40%, horizontal center 60%)
            left = Math.floor(canvas.width * 0.2);
            right = Math.ceil(canvas.width * 0.8);
            top = Math.floor(canvas.height * 0.08);
            bottom = Math.ceil(canvas.height * 0.35);
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

          const res: FloatingForegroundResult = chooseFloatingForegroundWithProtection(samples);
          if (active) {
            setContrastResult({
              textColor: res.color,
              tone: res.tone,
              contrast: res.minContrast,
              shadowProtection: res.shadowProtection,
            });
          }
        } catch {
          // Fallback to safe color on sampling failure
          const baseRgb = parseHex(background.color || '#f5f4ef');
          const shadedRgb = blend(baseRgb, [0, 0, 0], (background.shade || 0) / 100);
          const fallbackRes = chooseFloatingForegroundWithProtection([shadedRgb]);
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
          setContrastResult({
            textColor: '#141c20',
            tone: 'dark',
            contrast: 12.0,
            shadowProtection: 'none',
          });
        }
      };

      img.src = background.imageBlobUrl;

      // Listen for window resize
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
    targetRef,
  ]);

  return contrastResult;
}
