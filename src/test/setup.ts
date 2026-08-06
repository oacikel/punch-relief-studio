import '@testing-library/jest-dom/vitest';

// jsdom has no canvas/WebGL implementation; components that touch Three.js
// directly are covered by integration/E2E tests in a real browser instead
// (see docs/TEST_REPORT.md). Provide a minimal stub so component tests that
// merely *mount* a viewport wrapper don't throw on getContext calls.
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getContext) {
  // @ts-expect-error -- test-only stub
  HTMLCanvasElement.prototype.getContext = () => null;
}
