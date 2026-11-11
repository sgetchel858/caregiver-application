import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from https://<user>.github.io/<repo>/,
// so the base path comes from VITE_BASE at build time (default "/").
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
})
