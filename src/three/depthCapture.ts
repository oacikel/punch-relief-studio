/**
 * Capture camera-space depth (and, optionally, surface color) from an
 * orthographic viewpoint by rendering the mesh with a depth-encoding
 * material into an off-screen render target, then reading back pixels.
 * This is the one WebGL-risk module flagged in docs/PLAN.md -- kept small
 * and isolated; the actual numeric relief processing lives in the
 * WebGL-free src/domain/relief.ts.
 *
 * Nearest-visible-surface only: standard depth-buffer rendering already
 * guarantees occluded back surfaces never win, since the GPU depth test
 * keeps the closest fragment per pixel.
 */
import * as THREE from 'three';

export interface DepthCaptureResult {
  width: number;
  height: number;
  /** Camera-space linear depth per pixel; `emptyValue` where nothing was
   * rendered (background). */
  depth: Float32Array;
  emptyValue: number;
  /** RGBA surface color per pixel, present only if `captureColor` was set. */
  color?: Uint8ClampedArray;
}

export interface DepthCaptureOptions {
  width: number;
  height: number;
  captureColor?: boolean;
}

const EMPTY_DEPTH = -1;

export function captureDepth(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.OrthographicCamera,
  options: DepthCaptureOptions,
): DepthCaptureResult {
  const { width, height, captureColor = false } = options;

  const depthMaterial = new THREE.ShaderMaterial({
    uniforms: { cameraNear: { value: camera.near }, cameraFar: { value: camera.far } },
    vertexShader: `
      varying float vViewZ;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewZ = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vViewZ;
      uniform float cameraNear;
      uniform float cameraFar;
      void main() {
        float t = (vViewZ - cameraNear) / (cameraFar - cameraNear);
        gl_FragColor = vec4(t, t, t, 1.0);
      }
    `,
  });

  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
  });

  const previousOverride = scene.overrideMaterial;
  const previousTarget = renderer.getRenderTarget();
  const previousBackground = scene.background;
  scene.background = null;

  scene.overrideMaterial = depthMaterial;
  renderer.setRenderTarget(target);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);

  const raw = new Float32Array(width * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, width, height, raw);

  const depth = new Float32Array(width * height).fill(EMPTY_DEPTH);
  for (let i = 0; i < width * height; i++) {
    const alpha = raw[i * 4 + 3] as number;
    const t = raw[i * 4] as number;
    // Background pixels never get a fragment write, so alpha stays 0 from
    // the clear color; anything actually rendered has alpha 1.
    if (alpha > 0.5) {
      depth[i] = camera.near + t * (camera.far - camera.near);
    }
  }

  let color: Uint8ClampedArray | undefined;
  if (captureColor) {
    scene.overrideMaterial = null;
    renderer.setRenderTarget(target);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    const colorRaw = new Float32Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, colorRaw);
    color = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < colorRaw.length; i++) {
      color[i] = Math.round(Math.min(1, Math.max(0, colorRaw[i] as number)) * 255);
    }
  }

  scene.overrideMaterial = previousOverride;
  scene.background = previousBackground;
  renderer.setRenderTarget(previousTarget);
  target.dispose();
  depthMaterial.dispose();

  return { width, height, depth, emptyValue: EMPTY_DEPTH, color };
}

export { EMPTY_DEPTH };
