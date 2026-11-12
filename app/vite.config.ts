import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from https://<user>.github.io/<repo>/,
// so the base path comes from VITE_BASE at build time (default "/").
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Dev only: forward /api/v1 to Cognatum (e.g. https://app.cognatum-demo.com) so
  // `npm run dev` can call it same-origin. Beta's CORS allowlist never admits a
  // localhost origin, so the browser can't call it directly from the dev server.
  const silTarget = env.SIL_PROXY_TARGET
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: silTarget
        ? {
            '/api/v1': {
              target: silTarget,
              changeOrigin: true,
              secure: true,
              // Look like a same-origin call to the backend, not a localhost page.
              configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
            },
          }
        : undefined,
    },
    preview: { port: 4173 },
  }
})
