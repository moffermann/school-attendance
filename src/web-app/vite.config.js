import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/app/',
  build: {
    outDir: 'dist',
    emptyDirOnBuild: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8043',
      '/lib': 'http://localhost:8043',
    },
  },
});
