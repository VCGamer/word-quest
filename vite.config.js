import { defineConfig } from 'vite';

export default defineConfig({
  base: '/word-quest/',
  server: {
    host: true, // Listen on all interfaces for LAN access
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
