import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@rb/rb-apps': path.resolve(__dirname, 'packages/rb-apps/src'),
      '@rb/rb-windowing': path.resolve(__dirname, 'packages/rb-windowing/src'),
      '@rb/rb-shell': path.resolve(__dirname, 'packages/rb-shell/src'),
      '@rb/rb-theme': path.resolve(__dirname, 'packages/rb-theme/src'),
      '@redbyte/rb-tokens': path.resolve(__dirname, 'packages/rb-tokens/src')
    }
  }
})
