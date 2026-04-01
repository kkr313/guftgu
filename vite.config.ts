import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Tiny Vite plugin that stamps the service-worker cache name
 * with a unique build hash so every deploy busts the old cache.
 */
function swCacheBust(): import('vite').Plugin {
  return {
    name: 'sw-cache-bust',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (fs.existsSync(swPath)) {
        const hash = Date.now().toString(36);
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content.replace('__SW_CACHE_NAME__', `guftgu-${hash}`);
        fs.writeFileSync(swPath, content);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), swCacheBust()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8175,
    open: true,
  },
  build: {
    // Strip console.log/warn in production builds to prevent data leaks
    minify: 'esbuild',
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
