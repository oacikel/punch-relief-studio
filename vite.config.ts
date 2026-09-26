import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Punch Relief Studio is a fully static, client-side app: no backend, no
// server-side rendering. Base path is relative so the built `dist/` can be
// hosted from any subpath.
//
// T10: two *optional* build-time env vars, `VITE_VP_INGEST_URL` and
// `VITE_VP_PROJECT_TOKEN` (the latter is a public, write-only project
// token, not a secret -- see VenturePilot's ingest contract), opt in to
// consent-gated, privacy-scoped product analytics -- see
// `src/analytics/**` and `docs/ANALYTICS.md`. Neither is set for the
// public GitHub Pages build, so analytics stays fully inert there.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  // Exposes package.json's version as `import.meta.env.VITE_APP_VERSION`,
  // read by `src/analytics/config.ts` -- not a real environment variable,
  // just this build's single source of truth for the app version.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
