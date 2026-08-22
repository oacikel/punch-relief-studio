import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['e2e/**', 'src/test/**', '**/*.d.ts'],
    },
    // '.claude/worktrees/**' excludes nested per-agent git worktrees that
    // can live inside this repo directory (each with its own full
    // node_modules/src copy) -- without an explicit exclude here, Vitest's
    // default file discovery walks into them too, since providing a
    // custom `exclude` replaces (rather than extends) Vitest's own
    // sensible defaults. Found when `npm run test` from a checkout with
    // sibling worktrees present picked up and ran their test files too.
    exclude: ['e2e/**', 'node_modules/**', '.claude/worktrees/**'],
  },
});
