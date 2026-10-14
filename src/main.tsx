import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerBuiltinWidgets } from './widgets';
import { kickOffWallpaperPreload } from './services/storage/wallpaper';
import './index.css';

// 0ms 启动同步注入背景色与并行预热壁纸 (C029): 杜绝冷启动白屏，并抢先发起 IndexedDB 异步读取
try {
  const rawBoot = localStorage.getItem('oh_my_tab_boot_cache');
  if (rawBoot) {
    const boot = JSON.parse(rawBoot);
    if (boot && boot.background) {
      const bg = boot.background;
      if (bg.type === 'color' && bg.color) {
        document.documentElement.style.backgroundColor = bg.color;
      } else if (bg.type === 'material') {
        const colors: Record<string, string> = { dark: '#1c1917', blue: '#e8eef5', default: '#f5f4ef' };
        document.documentElement.style.backgroundColor = colors[bg.name] || '#f5f4ef';
      } else if (bg.type === 'image' && bg.imageId) {
        // 在 React 挂载与组件树解析前，即刻发起底层 IndexedDB 读取与异步解码 (C029)
        kickOffWallpaperPreload(bg.imageId);
      }
    }
  }
} catch (e) {
  console.debug('[Main] preboot background sync failed:', e);
}

// Initialize builtin widgets into widget registry
registerBuiltinWidgets();

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
