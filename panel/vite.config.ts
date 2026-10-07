import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// O painel é servido pelo próprio bot em /painel (ver src/panel/index.ts do bot)
export default defineConfig({
  base: '/painel/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/painel/api': {
        target: process.env.SB_PANEL_API || 'http://192.168.1.5:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200
  }
})
