import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerBuiltinWidgets } from './widgets';
import './index.css';

// 0ms 启动同步注入背景色 (C029): 读取 bootCache 即刻设置 html 样式，杜绝冷启动与主题切换白屏
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
