import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fitOrthographicCamera } from '../viewport';

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
