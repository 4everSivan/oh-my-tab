const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 1. WCAG Contrast & Geometric Calculations
const {
  parseHex,
  luminance,
  contrastRatio,
  blend,
} = require('../docs/assets/homepage-study/homepage-background-contrast.js');

function coverRect(imageWidth, imageHeight, frameWidth, frameHeight, position = 'center') {
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

function chooseFloatingForegroundWithProtection(samples) {
  const LIGHT_RGB = [255, 255, 255];
  const DARK_RGB = [20, 28, 32];

  if (!Array.isArray(samples) || !samples.length) {
    return {
      tone: 'dark',
      color: '#141c20',
      minContrast: 1,
      shadowProtection: 'none',
    };
  }

  const candidates = [
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

test('coverRect scales image to cover frame with proper alignment', () => {
  // Landscape image into portrait window
  const rectCenter = coverRect(1920, 1080, 800, 1200, 'center');
  assert.ok(rectCenter.height >= 1200);
  assert.ok(rectCenter.width >= 800);
  assert.equal(rectCenter.y, (1200 - rectCenter.height) / 2);

  // Top alignment
  const rectTop = coverRect(1920, 1080, 800, 1200, 'top');
  assert.equal(rectTop.y, 0);

  // Bottom alignment
  const rectBottom = coverRect(1920, 1080, 800, 1200, 'bottom');
  assert.equal(rectBottom.y, 1200 - rectBottom.height);
});

test('Dark background samples select pure white ink with high contrast', () => {
  // Deep dark night samples (RGB ~ [20, 24, 35])
  const darkSamples = [
    [20, 24, 35],
    [22, 26, 38],
    [15, 18, 28],
    [25, 28, 40],
  ];

  const result = chooseFloatingForegroundWithProtection(darkSamples);
  assert.equal(result.tone, 'light');
  assert.equal(result.color, '#ffffff');
  assert.ok(result.minContrast >= 14.0);
  assert.equal(result.shadowProtection, 'none'); // High contrast doesn't need extra halo
});

test('Light background samples select dark ink with high contrast', () => {
  // Light paper samples (RGB ~ [245, 244, 239])
  const lightSamples = [
    [245, 244, 239],
    [240, 238, 230],
    [250, 248, 245],
  ];

  const result = chooseFloatingForegroundWithProtection(lightSamples);
  assert.equal(result.tone, 'dark');
  assert.equal(result.color, '#141c20');
  assert.ok(result.minContrast >= 14.0);
  assert.equal(result.shadowProtection, 'none');
});

test('Low contrast or complex texture samples automatically trigger adaptive shadow protection', () => {
  // Mixed mid-tone samples where contrast with both white and dark falls below 4.5:1
  const midToneSamples = [
    [128, 128, 128],
    [135, 130, 125],
    [120, 125, 130],
  ];

  const result = chooseFloatingForegroundWithProtection(midToneSamples);
  assert.ok(result.minContrast < 4.5);
  // Must provide adaptive shadow protection halo!
  assert.notEqual(result.shadowProtection, 'none');
  assert.ok(result.shadowProtection.includes('rgba'));
});

// 2. CSS Motion Tokens & Classes for Advanced Transitions
test('motion.css defines workspace-container accordion collapse rules', () => {
  const motionCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/motion.css'), 'utf-8');
  assert.ok(motionCss.includes('.workspace-container'));
  assert.ok(motionCss.includes('.workspace-container[data-collapsed=\'true\']'));
  assert.ok(motionCss.includes('max-height'));
  assert.ok(motionCss.includes('overflow: hidden'));
});

test('motion.css defines t-stagger-item, origin-menu, t-tabs-sliding, and t-toast', () => {
  const motionCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/motion.css'), 'utf-8');
  assert.ok(motionCss.includes('.t-stagger-item'));
  assert.ok(motionCss.includes('@keyframes t-stagger-rise'));
  assert.ok(motionCss.includes('.origin-menu'));
  assert.ok(motionCss.includes('.t-tabs-sliding'));
  assert.ok(motionCss.includes('.t-toast'));
  assert.ok(motionCss.includes('@keyframes t-toast-rise'));
});

test('prefers-reduced-motion guard covers new transitions', () => {
  const motionCss = fs.readFileSync(path.resolve(__dirname, '../src/styles/motion.css'), 'utf-8');
  const reducedIndex = motionCss.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(reducedIndex > -1);
  const guardBlock = motionCss.slice(reducedIndex);

  assert.ok(guardBlock.includes('.workspace-container'));
  assert.ok(guardBlock.includes('.t-stagger-item'));
  assert.ok(guardBlock.includes('.origin-menu'));
  assert.ok(guardBlock.includes('.t-tabs-sliding'));
  assert.ok(guardBlock.includes('.t-toast'));
});

test('Clock component renders tabular-nums on digits and accepts shadowProtection', () => {
  const clockTsx = fs.readFileSync(path.resolve(__dirname, '../src/components/clock/Clock.tsx'), 'utf-8');
  assert.ok(clockTsx.includes('shadowProtection'));
  assert.ok(clockTsx.includes('tabular-nums'));
});
