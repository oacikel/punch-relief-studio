import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Punch Relief Studio is a fully static, client-side app: no backend, no
// server-side rendering, no environment-variable secrets. Base path is
// relative so the built `dist/` can be hosted from any subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
