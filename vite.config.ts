import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Proxy /api to Express (dev) or use same target for preview so local preview matches Vercel behavior
    const apiProxy = {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    };
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: apiProxy,
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        proxy: apiProxy,
      },
      plugins: [react()],
      define: {
        // Removed Gemini API key - no longer used for investor extraction
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom'],
      }
    };
});
