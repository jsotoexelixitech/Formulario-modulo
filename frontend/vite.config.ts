import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const tunnel = env.VITE_HMR_TUNNEL === '1' || env.VITE_HMR_TUNNEL === 'true'

  // Mismo mapa de proxy para el dev server (`vite`) y para `vite preview`
  // (producción sirve el build con preview, que NO hereda `server.proxy`).
  const proxy = {
    '/api': { target: 'http://localhost:4002', changeOrigin: true },
    '/files': { target: 'http://localhost:4002', changeOrigin: true },
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5182,
      allowedHosts: true,
      hmr: tunnel ? { clientPort: 443, protocol: 'wss' } : true,
      proxy,
    },
    preview: {
      host: true,
      allowedHosts: true,
      proxy,
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
  }
})
