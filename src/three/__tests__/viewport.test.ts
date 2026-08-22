import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  fitOrthographicCamera,
  fitOrthographicCameraToExtent,
  projectedHalfExtent,
} from '../viewport';

function frustumSize(camera: THREE.OrthographicCamera): { width: number; height: number } {
  return { width: camera.right - camera.left, height: camera.top - camera.bottom };
}

describe('fitOrthographicCamera', () => {
  it('produces a square frustum for a square (1:1) canvas', () => {
    const camera = new THREE.OrthographicCamera();
    fitOrthographicCamera(camera, 4, 1.15, 1);
    const { width, height } = frustumSize(camera);
    expect(width).toBeCloseTo(height);
  });

  it('widens the frustum for a landscape (wide) canvas without shrinking the fitted radius', () => {
    const camera = new THREE.OrthographicCamera();
    const aspect = 2;
    fitOrthographicCamera(camera, 4, 1.15, aspect);
    const { width, height } = frustumSize(camera);
    // The smaller (height) dimension is unchanged from the square case, so the
    // object is never clipped; the wider dimension grows to match the canvas.
    expect(height).toBeCloseTo(4 * 1.15 * 2);
    expect(width / height).toBeCloseTo(aspect);
  });

  it('heightens the frustum for a portrait (tall) canvas without shrinking the fitted radius', () => {
    const camera = new THREE.OrthographicCamera();
    const aspect = 372 / 684; // matches the sticky Relief-preview column's proportions
    fitOrthographicCamera(camera, 4, 1.15, aspect);
    const { width, height } = frustumSize(camera);
    // The smaller (width) dimension is unchanged from the square case; the
    // taller dimension grows so the render isn't stretched into an ellipse.
    expect(width).toBeCloseTo(4 * 1.15 * 2);
    expect(width / height).toBeCloseTo(aspect);
  });

  it('keeps left/right and top/bottom symmetric around the origin', () => {
    const camera = new THREE.OrthographicCamera();
    fitOrthographicCamera(camera, 3, 1.2, 0.6);
    expect(camera.left).toBeCloseTo(-camera.right);
    expect(camera.bottom).toBeCloseTo(-camera.top);
  });
});

const RIGHT = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

describe('projectedHalfExtent', () => {
  it('matches a box`s own half-extents for an axis-aligned front view', () => {
    const box = new THREE.Box3(new THREE.Vector3(-4, -1, -3), new THREE.Vector3(4, 1, 3));
    const extent = projectedHalfExtent(box, RIGHT, UP);
    expect(extent.halfWidth).toBeCloseTo(4);
    expect(extent.halfHeight).toBeCloseTo(1);
  });

  it('reflects only the screen-relevant axes -- depth (Z) extent is invisible to a front view', () => {
    // A flat/wide relief-shaped box: large X/Z footprint, thin Y.
    const flatWide = new THREE.Box3(new THREE.Vector3(-8, -0.5, -8), new THREE.Vector3(8, 0.5, 8));
    const extent = projectedHalfExtent(flatWide, RIGHT, UP);
    // Front view shows X (width) and Y (height) only -- Z (depth) never
    // inflates the frustum, unlike an isotropic bounding-sphere radius
    // would (which would be dominated by the X/Z diagonal).
    expect(extent.halfWidth).toBeCloseTo(8);
    expect(extent.halfHeight).toBeCloseTo(0.5);
  });

  it('grows the projected extent for a box rotated 45 degrees about the view axis', () => {
    const box = new THREE.Box3(new THREE.Vector3(-2, -2, -1), new THREE.Vector3(2, 2, 1));
    const matrixWorld = new THREE.Matrix4().makeRotationZ(Math.PI / 4);
    const rotated = projectedHalfExtent(box, RIGHT, UP, matrixWorld);
    const unrotated = projectedHalfExtent(box, RIGHT, UP);
    expect(rotated.halfWidth).toBeGreaterThan(unrotated.halfWidth);
    expect(rotated.halfHeight).toBeGreaterThan(unrotated.halfHeight);
  });

  it('applies matrixWorld before projecting, not after', () => {
    // A unit box translated far along +X by matrixWorld -- the projected
    // half-width must include that translation's contribution, not just
    // the box's own local half-width.
    const box = new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const matrixWorld = new THREE.Matrix4().makeTranslation(10, 0, 0);
    const extent = projectedHalfExtent(box, RIGHT, UP, matrixWorld);
    expect(extent.halfWidth).toBeCloseTo(11); // 10 (translation) + 1 (local half-width)
  });
});

describe('fitOrthographicCameraToExtent', () => {
  it('produces a square frustum for a square (1:1) canvas and symmetric content', () => {
    const camera = new THREE.OrthographicCamera();
    fitOrthographicCameraToExtent(camera, { halfWidth: 4, halfHeight: 4 }, 1.15, 1);
    expect(camera.right - camera.left).toBeCloseTo(camera.top - camera.bottom);
  });

  it('fills the frame far better than an isotropic sphere fit for a flat/wide (relief-shaped) model', () => {
    // This is the actual bug (docs/ITERATION_03_PLAN.md #1): a bas-relief
    // box with a modest footprint (8 x 8 half-extent) but a shallow relief
    // height (2 half-extent) -- front-view-relevant extent is X (width,
    // large) and Y (height, small); Z (depth) never appears on screen from
    // the front, but it does inflate an isotropic bounding-sphere radius.
    const aspect = 4 / 3;
    const hx = 8;
    const hy = 2;
    const hz = 8; // depth -- irrelevant to the front-view screen extent

    // Old behavior: an isotropic sphere radius (the box's own half-diagonal)
    // fed through the pre-existing sphere-based fit.
    const sphereRadius = Math.hypot(hx, hy, hz);
    const oldCamera = new THREE.OrthographicCamera();
    fitOrthographicCamera(oldCamera, sphereRadius, 1.15, aspect);
    const oldFrameHeight = oldCamera.top - oldCamera.bottom;

    // New behavior: the real 2D projected extent for the front view (X/Y
    // only) through the new extent-based fit.
    const newCamera = new THREE.OrthographicCamera();
    fitOrthographicCameraToExtent(newCamera, { halfWidth: hx, halfHeight: hy }, 1.15, aspect);
    const newFrameHeight = newCamera.top - newCamera.bottom;

    // The extent-based fit must never be worse, and for this genuinely
    // flat/wide shape should waste meaningfully less vertical frame space
    // than the isotropic sphere fit did.
    expect(newFrameHeight).toBeLessThan(oldFrameHeight * 0.6);
    // ...while still comfortably containing the real content height.
    expect(newFrameHeight).toBeGreaterThanOrEqual(hy * 2 * 1.15 - 1e-9);
  });

  it('never clips content: frustum half-extents are always >= the padded content extents', () => {
    const extent = { halfWidth: 3, halfHeight: 9 };
    const camera = new THREE.OrthographicCamera();
    fitOrthographicCameraToExtent(camera, extent, 1.15, 1.7);
    expect(camera.right).toBeGreaterThanOrEqual(extent.halfWidth * 1.15 - 1e-9);
    expect(camera.top).toBeGreaterThanOrEqual(extent.halfHeight * 1.15 - 1e-9);
  });

  it('matches the canvas aspect ratio exactly', () => {
    const camera = new THREE.OrthographicCamera();
    const aspect = 372 / 684;
    fitOrthographicCameraToExtent(camera, { halfWidth: 5, halfHeight: 2 }, 1.15, aspect);
    const frameAspect = (camera.right - camera.left) / (camera.top - camera.bottom);
    expect(frameAspect).toBeCloseTo(aspect);
  });

  it('keeps left/right and top/bottom symmetric around the origin', () => {
    const camera = new THREE.OrthographicCamera();
    fitOrthographicCameraToExtent(camera, { halfWidth: 6, halfHeight: 2 }, 1.2, 0.6);
    expect(camera.left).toBeCloseTo(-camera.right);
    expect(camera.bottom).toBeCloseTo(-camera.top);
  });

  it('does not produce a degenerate/NaN frustum for a single-point (zero-size) extent', () => {
    const camera = new THREE.OrthographicCamera();
    fitOrthographicCameraToExtent(camera, { halfWidth: 0, halfHeight: 0 }, 1.15, 1);
    expect(Number.isFinite(camera.left)).toBe(true);
    expect(Number.isFinite(camera.right)).toBe(true);
    expect(camera.right).toBeGreaterThan(0);
  });
});
