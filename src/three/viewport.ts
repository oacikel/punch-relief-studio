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

/** Content half-width/half-height (in world units) that an orthographic
 * frustum needs to frame something along a given screen-space right/up
 * basis -- see `projectedHalfExtent`. */
export interface ContentExtent {
  halfWidth: number;
  halfHeight: number;
}

const BOX_CORNER_SIGNS: ReadonlyArray<readonly [number, number, number]> = [
  [-1, -1, -1],
  [-1, -1, 1],
  [-1, 1, -1],
  [-1, 1, 1],
  [1, -1, -1],
  [1, -1, 1],
  [1, 1, -1],
  [1, 1, 1],
];

/**
 * Projects a box's 8 corners onto the given screen-space `right`/`up` axes
 * (typically a camera's own local X/Y basis vectors, e.g. read from
 * `camera.matrixWorld`) and returns the half-width/half-height an
 * orthographic frustum needs to frame the box exactly for that view
 * direction -- unlike an isotropic bounding-sphere radius, this correctly
 * reflects that a flat/wide model (small extent along the current view's
 * depth axis) doesn't need a tall frustum just because it's wide, or vice
 * versa (docs/ITERATION_03_PLAN.md #1 / Iteration 03 Round 2). `matrixWorld`,
 * if given, is applied to each corner first -- e.g. a straightened/rotated
 * mesh's transform -- so `box` should be the geometry's own local-space
 * bounding box in that case, not a pre-transformed one.
 *
 * This frames the box's corners, not the mesh's true silhouette -- exact
 * for any axis-aligned standard view of an unrotated box, and always a
 * safe (never-clipping) over-estimate for an arbitrarily rotated model or
 * off-axis orbit angle, at the cost of some slack versus a perfect
 * silhouette fit in that case. A from-scratch per-vertex silhouette
 * projection was considered and rejected as unnecessary complexity for a
 * flat-relief-shaped input, where the bounding box is already a tight fit.
 */
export function projectedHalfExtent(
  box: THREE.Box3,
  right: THREE.Vector3,
  up: THREE.Vector3,
  matrixWorld?: THREE.Matrix4,
): ContentExtent {
  let halfWidth = 0;
  let halfHeight = 0;
  const corner = new THREE.Vector3();
  for (const [sx, sy, sz] of BOX_CORNER_SIGNS) {
    corner.set(
      sx < 0 ? box.min.x : box.max.x,
      sy < 0 ? box.min.y : box.max.y,
      sz < 0 ? box.min.z : box.max.z,
    );
    if (matrixWorld) corner.applyMatrix4(matrixWorld);
    halfWidth = Math.max(halfWidth, Math.abs(corner.dot(right)));
    halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));
  }
  return { halfWidth, halfHeight };
}

// Floor applied to padded content half-extents before computing their
// ratio, so a fully degenerate (zero-size in both axes) box can't produce
// a NaN/zero frustum. Real geometry is always far larger than this: it
// only matters for the single-point edge case.
const MIN_PADDED_HALF_EXTENT = 1e-6;

/**
 * Fits an orthographic camera's frustum to a real content half-width/
 * half-height (see `projectedHalfExtent`) rather than an isotropic sphere
 * radius -- the object fills the canvas along whichever screen axis it's
 * proportionally larger on, instead of wasting space on the shorter axis
 * to match a symmetric radius (the flat/wide-relief framing bug in
 * docs/ITERATION_03_PLAN.md #1). `paddingFactor` and the aspect-fill
 * behavior otherwise match `fitOrthographicCamera`: the content always
 * fits within the frustum (never clipped), and the canvas's non-binding
 * dimension is expanded (never the content shrunk) to fill the aspect
 * ratio.
 */
export function fitOrthographicCameraToExtent(
  camera: THREE.OrthographicCamera,
  extent: ContentExtent,
  paddingFactor = 1.15,
  aspect = 1,
): void {
  const paddedHalfWidth = Math.max(extent.halfWidth * paddingFactor, MIN_PADDED_HALF_EXTENT);
  const paddedHalfHeight = Math.max(extent.halfHeight * paddingFactor, MIN_PADDED_HALF_EXTENT);
  const contentAspect = paddedHalfWidth / paddedHalfHeight;

  let halfWidth: number;
  let halfHeight: number;
  if (contentAspect > aspect) {
    // Content is proportionally wider than the canvas -- width is the
    // binding constraint; height is derived from it so nothing stretches.
    halfWidth = paddedHalfWidth;
    halfHeight = paddedHalfWidth / aspect;
  } else {
    halfHeight = paddedHalfHeight;
    halfWidth = paddedHalfHeight * aspect;
  }

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = 0.01;
  camera.far = Math.max(halfWidth, halfHeight) * 8 + 10;
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
