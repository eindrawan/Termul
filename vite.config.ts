import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        splash: resolve(__dirname, 'splash.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@/components': resolve(__dirname, 'src/renderer/components'),
      '@/services': resolve(__dirname, 'src/renderer/services'),
      '@/types': resolve(__dirname, 'src/renderer/types'),
      '@/utils': resolve(__dirname, 'src/renderer/utils'),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
  },
})