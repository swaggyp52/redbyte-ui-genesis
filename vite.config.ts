import WindiCSS from 'vite-plugin-windicss'
import ImageminPlugin from 'vite-plugin-imagemin'

export default {
  plugins: [
    WindiCSS(),
    ImageminPlugin({
      mozjpeg: { quality: 75 },
      pngquant: { quality: [0.6, 0.8] }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'] 
        }
      }
    }
  }
}


