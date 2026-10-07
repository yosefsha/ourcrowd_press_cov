/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The backend API listens on 8000 (docs/backend-nestjs-instructions.md). In
// development the dashboard and the API share one origin through this proxy,
// exactly as they do behind nginx in the container, so the client only ever
// uses relative `/api` URLs and cookies need no CORS handling.
const BACKEND_URL = 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: BACKEND_URL, changeOrigin: false },
      '/health': { target: BACKEND_URL, changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
