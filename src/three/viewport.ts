/**
 * Camera-fit, centering, and standard-view math for the 3D viewport.
 * Kept as plain functions over a bounding box + camera so the numeric
 * behavior (fit distance, standard view quaternions) is unit testable
 * without a live WebGL context.
 */
import * as THREE from 'three';

export type StandardView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

const VIEW_DIRECTIONS: Record<StandardView, THREE.Vector3> = {
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
};

export function directionForStandardView(view: StandardView): THREE.Vector3 {
  return VIEW_DIRECTIONS[view].clone();
}

/** Center a geometry on its own bounding-box centroid and return the
 * (pre-centering) size, so callers can normalize scale deterministically. */
export function centerAndMeasure(geometry: THREE.BufferGeometry): { size: THREE.Vector3; radius: number } {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox as THREE.Box3;
  const center = box.getCenter(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const size = new THREE.Vector3();
  (geometry.boundingBox as THREE.Box3).getSize(size);
  const radius = geometry.boundingSphere?.radius ?? Math.max(size.x, size.y, size.z) / 2;
  return { size, radius };
}

/** Uniformly scale a geometry so its largest dimension equals `targetSize`. */
export function normalizeScale(geometry: THREE.BufferGeometry, targetSize = 10): number {
  geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  (geometry.boundingBox as THREE.Box3).getSize(size);
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / largest;
  geometry.scale(scale, scale, scale);
  return scale;
}

/** Distance an orthographic camera needs from the origin to comfortably
 * frame a sphere of the given radius, plus the ortho frustum half-size. */
export function fitOrthographicCamera(
  camera: THREE.OrthographicCamera,
  radius: number,
  paddingFactor = 1.15,
): void {
  const half = radius * paddingFactor;
  camera.left = -half;
  camera.right = half;
  camera.top = half;
  camera.bottom = -half;
  camera.near = 0.01;
  camera.far = radius * 8 + 10;
  camera.updateProjectionMatrix();
}

export function applyStandardView(camera: THREE.Camera, view: StandardView, distance: number): void {
  const dir = directionForStandardView(view).multiplyScalar(distance);
  camera.position.copy(dir);
  camera.lookAt(0, 0, 0);
  camera.up.set(view === 'top' ? 0 : 0, view === 'top' || view === 'bottom' ? 0 : 1, view === 'top' ? -1 : view === 'bottom' ? 1 : 0);
}
