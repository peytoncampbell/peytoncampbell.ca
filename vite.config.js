import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Custom-domain GitHub Pages site, so nested static routes need root-relative assets.
  base: '/',
  build: {
    outDir: 'docs',
    emptyOutDir: false,
  },
})
