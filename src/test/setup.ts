import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vitest doesn't inject global test hooks (no `globals: true`), and
// @testing-library/react's auto-cleanup relies on detecting a global
// `afterEach`. Register it explicitly so DOM trees from one test's render()
// don't leak into the next test in the same file.
afterEach(cleanup);

// jsdom has no canvas/WebGL implementation; components that touch Three.js
// directly are covered by integration/E2E tests in a real browser instead
// (see docs/TEST_REPORT.md). Provide a minimal stub so component tests that
// merely *mount* a viewport wrapper don't throw on getContext calls.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () => null;
}

// jsdom has no Blob URL implementation. Import validation logic only needs
// distinct, revocable-looking URLs -- not real blob storage -- so a simple
// counter-based stub is sufficient for unit tests (see
// src/domain/import/objLoader.ts).
if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  URL.createObjectURL = () => `blob:mock-${++counter}`;
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
