import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dockerized backend is published on host port 8081 (8080 is taken by the Forum project)
      '/api':    { target: 'http://localhost:8081', changeOrigin: true },
      '/health': { target: 'http://localhost:8081', changeOrigin: true },
      '/ready':  { target: 'http://localhost:8081', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
