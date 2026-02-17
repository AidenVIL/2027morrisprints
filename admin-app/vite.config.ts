import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  server: {
    // Proxy API calls to the production backend during local dev to avoid CORS
    proxy: {
      '/api': {
        target: 'https://morrisprints.co.uk',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  }
})
