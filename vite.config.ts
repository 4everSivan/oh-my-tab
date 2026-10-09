import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/suggest-bing': {
        target: 'https://api.bing.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/suggest-bing/, ''),
      },
      '/api/suggest-google': {
        target: 'https://suggestqueries.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/suggest-google/, ''),
      },
      '/api/suggest-bilibili': {
        target: 'https://s.search.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/suggest-bilibili/, ''),
      },
      '/api/suggest-baidu': {
        target: 'https://suggestion.baidu.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/suggest-baidu/, ''),
      },
    },
  },
  build: {
    outDir: resolve(__dirname, 'local/dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
