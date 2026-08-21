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
export function centerAndMeasure(geometry: THREE.BufferGeometry): {
  size: THREE.Vector3;
  radius: number;
} {
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
 * frame a sphere of the given radius, plus the ortho frustum half-size.
 * `aspect` (canvas width / height) keeps the frustum's proportions matched
 * to the canvas so the render isn't stretched -- the object always fits
 * within the *smaller* screen dimension, with the larger dimension scaled
 * by `aspect` to fill it exactly. */
export function fitOrthographicCamera(
  camera: THREE.OrthographicCamera,
  radius: number,
  paddingFactor = 1.15,
  aspect = 1,
): void {
  const half = radius * paddingFactor;
  const halfWidth = aspect >= 1 ? half * aspect : half;
  const halfHeight = aspect >= 1 ? half : half / aspect;
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = 0.01;
  camera.far = radius * 8 + 10;
  camera.updateProjectionMatrix();
}

export function applyStandardView(
  camera: THREE.Camera,
  view: StandardView,
  distance: number,
): void {
  const dir = directionForStandardView(view).multiplyScalar(distance);
  camera.position.copy(dir);
  camera.lookAt(0, 0, 0);
  // Looking straight down/up needs a horizontal up-vector (camera.lookAt
  // can't derive one from a vertical view direction); every other
  // standard view uses the ordinary world-up.
  if (view === 'top') camera.up.set(0, 0, -1);
  else if (view === 'bottom') camera.up.set(0, 0, 1);
  else camera.up.set(0, 1, 0);
}
