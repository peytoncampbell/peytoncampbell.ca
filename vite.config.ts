import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1800,
  },
  server: {
    host: '0.0.0.0',
  },
})
