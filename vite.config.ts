import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@redbyte/rb-apps', replacement: path.resolve(__dirname, 'packages/rb-apps/src') },
      { find: '@redbyte/rb-windowing', replacement: path.resolve(__dirname, 'packages/rb-windowing/src') },
      { find: '@redbyte/rb-shell', replacement: path.resolve(__dirname, 'packages/rb-shell/src') },
      { find: '@redbyte/rb-theme', replacement: path.resolve(__dirname, 'packages/rb-theme/src') },
      { find: '@redbyte/rb-tokens', replacement: path.resolve(__dirname, 'packages/rb-tokens/src') }
    ]
  }
})
