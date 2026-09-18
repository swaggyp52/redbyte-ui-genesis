import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Daily Plate',
        short_name: 'Daily Plate',
        description: 'Log what you had. See where you stand. Get on with your day.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAF7F0',
        theme_color: '#FAF7F0',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          scanner: ['@zxing/browser', '@zxing/library'],
        },
      },
    },
  },
});
