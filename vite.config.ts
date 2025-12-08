import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@redbyte/rb-apps': path.resolve(__dirname, 'packages/rb-apps/src'),
      '@redbyte/rb-windowing': path.resolve(__dirname, 'packages/rb-windowing/src'),
      '@redbyte/rb-shell': path.resolve(__dirname, 'packages/rb-shell/src'),
      '@redbyte/rb-theme': path.resolve(__dirname, 'packages/rb-theme/src'),
      '@redbyte/rb-tokens': path.resolve(__dirname, 'packages/rb-tokens/src')
    }
  }
})
