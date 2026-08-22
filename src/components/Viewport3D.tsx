import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { captureDepth, type DepthCaptureResult } from '@/three/depthCapture';
import {
  applyStandardView,
  centerAndMeasure,
  fitOrthographicCamera,
  fitOrthographicCameraToExtent,
  normalizeScale,
  projectedHalfExtent,
  type StandardView,
} from '@/three/viewport';

export interface Viewport3DHandle {
  capture: (resolution: number, captureColor: boolean) => DepthCaptureResult | null;
}

interface Props {
  geometry: THREE.BufferGeometry | null;
  invertNearFar?: boolean;
  onReady?: (handle: Viewport3DHandle) => void;
}

const STANDARD_VIEWS: StandardView[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Model-straightening rotation, in degrees (docs/ITERATION_03_PLAN.md #5).
 * `OrbitControls` orbits the *camera* around the model while deliberately
 * preserving world-up, so it can never compensate for a model that's
 * tilted/rotated around its own axis on import -- these three sliders
 * rotate the model itself instead. Named by convention (roll = around the
 * forward/view axis, pitch = around the lateral axis, yaw = around the
 * vertical axis) under this app's Y-up, front-is-+Z world convention (see
 * `VIEW_DIRECTIONS` in src/three/viewport.ts): roll -> object-space Z,
 * pitch -> object-space X, yaw -> object-space Y. */
interface RotationDeg {
  roll: number;
  pitch: number;
  yaw: number;
}
const ZERO_ROTATION: RotationDeg = { roll: 0, pitch: 0, yaw: 0 };

/**
 * Interactive 3D viewport: orbit/pan/zoom, standard-view buttons, reset,
 * model-straightening rotation, and orthographic framing used both for
 * inspection and as the basis for relief capture. WebGL setup lives
 * entirely in this one component so it can fail gracefully (see the
 * try/catch around renderer creation) without taking the rest of the app
 * down -- caught failures bubble to <ErrorBoundary> only if truly
 * unrecoverable.
 */
export function Viewport3D({ geometry, onReady }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const radiusRef = useRef(6);
  // The geometry's own local-space bounding box (post centering/scale, pre
  // any straightening rotation) -- kept so `refit` can re-derive an exact
  // 2D-projected content extent for whatever direction the camera/mesh are
  // currently oriented to, instead of an isotropic sphere radius (see
  // docs/ITERATION_03_PLAN.md #1 / docs/DECISIONS.md). `null` before a
  // model has ever loaded.
  const contentBoxRef = useRef<THREE.Box3 | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  // Local component state, deliberately not lifted to AppState -- mirrors
  // how the existing camera-view state already persists across Import <->
  // Relief navigation today: this Viewport3D instance is never remounted
  // between those two stages (see e2e/orient-persistence.spec.ts), so
  // local state survives the same way, with no schema/persistence changes
  // needed.
  const [rotationDeg, setRotationDeg] = useState<RotationDeg>(ZERO_ROTATION);

  /**
   * Re-fits the camera's orthographic frustum to the model's real 2D
   * projected extent for whatever direction the camera is currently facing
   * (docs/ITERATION_03_PLAN.md #1) -- reads `cameraRef`/`meshRef`/
   * `contentBoxRef` at call time (all refs, so this stays correct however
   * long ago the closure itself was created; the `useCallback([])` below
   * only exists to keep the function identity stable for effect deps, not
   * because it captures anything that changes). Falls back to the old
   * isotropic-sphere fit when there's no content box yet (before any model
   * has loaded). `aspectOverride` lets `capture` temporarily fit to the
   * (always square) capture resolution's aspect regardless of the on-screen
   * canvas's own aspect, since the two can differ.
   */
  const refit = useCallback((aspectOverride?: number): void => {
    const camera = cameraRef.current;
    if (!camera) return;
    const container = containerRef.current;
    const aspect =
      aspectOverride ??
      (container && container.clientHeight ? container.clientWidth / container.clientHeight : 1);

    const box = contentBoxRef.current;
    if (box) {
      camera.updateMatrixWorld();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const forward = new THREE.Vector3();
      camera.matrixWorld.extractBasis(right, up, forward);
      const mesh = meshRef.current;
      mesh?.updateMatrixWorld();
      const extent = projectedHalfExtent(box, right.normalize(), up.normalize(), mesh?.matrixWorld);
      fitOrthographicCameraToExtent(camera, extent, 1.15, aspect);
    } else {
      fitOrthographicCamera(camera, radiusRef.current, 1.15, aspect);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setInitError(
        'Your browser could not start WebGL, which this app needs for the 3D viewport. Try ' +
          'updating your browser or graphics drivers.',
      );
      return;
    }

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1b19);
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(5, 8, 6);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 100);
    applyStandardView(camera, 'front', 12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    let frame = 0;
    const animate = (): void => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    onReady?.({
      capture: (resolution, captureColor) => {
        if (!meshRef.current) return null;
        // The capture render target is always square (`resolution` used for
        // both width and height -- see App.tsx), but the on-screen frustum
        // is fit to the *container's* aspect, which is usually not square.
        // Rendering through a mismatched frustum aspect into a square
        // target silently stretches the captured depth/color, which then
        // propagates into the actual relief geometry -- not just a display
        // artifact. Refit to a square aspect just for the capture, then
        // restore the on-screen framing (including near/far -- `refit`
        // mutates those too via `fitOrthographicCameraToExtent`) immediately
        // after, so the live viewport's own view is unaffected by
        // generating a relief.
        const saved = {
          left: camera.left,
          right: camera.right,
          top: camera.top,
          bottom: camera.bottom,
          near: camera.near,
          far: camera.far,
        };
        refit(1);
        const result = captureDepth(renderer, scene, camera, {
          width: resolution,
          height: resolution,
          captureColor,
        });
        camera.left = saved.left;
        camera.right = saved.right;
        camera.top = saved.top;
        camera.bottom = saved.bottom;
        camera.near = saved.near;
        camera.far = saved.far;
        camera.updateProjectionMatrix();
        return result;
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      refit(w / h);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera || !geometry) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
    }
    const { radius } = centerAndMeasure(geometry);
    normalizeScale(geometry, 8);
    const measured = centerAndMeasure(geometry);
    radiusRef.current = measured.radius || radius || 4;
    contentBoxRef.current = geometry.boundingBox ? geometry.boundingBox.clone() : null;

    const material = new THREE.MeshStandardMaterial({
      color: 0xb5563c,
      roughness: 0.8,
      metalness: 0.05,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    meshRef.current = mesh;
    // A newly loaded model always starts unrotated -- straightening is
    // per-import, not a property of the mesh data itself. Reset the new
    // mesh's rotation directly rather than applying whatever the previous
    // model's rotationDeg happened to be first (that would apply stale
    // rotation for one frame before the state-reset effect below
    // overwrote it back to zero).
    mesh.rotation.set(0, 0, 0);
    setRotationDeg(ZERO_ROTATION);

    // Position the camera first (sets its orientation/basis), then fit the
    // frustum to the model's real projected extent for that orientation --
    // `refit` needs the camera's basis vectors to already be correct.
    applyStandardView(camera, 'front', radiusRef.current * 3);
    refit();
  }, [geometry, refit]);

  // Apply the model-straightening rotation to the mesh in place -- no
  // geometry rebuild, no controls change, so dragging a rotation slider
  // never fights an in-progress orbit drag. Framing *is* re-fit here
  // (unlike before): straightening a tilted model changes its on-screen
  // projected extent for the current view direction, so a stale frustum
  // fit to the old (tilted) extent would otherwise waste frame space or,
  // for a large enough correction, risk framing too tight.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.set(
      THREE.MathUtils.degToRad(rotationDeg.pitch),
      THREE.MathUtils.degToRad(rotationDeg.yaw),
      THREE.MathUtils.degToRad(rotationDeg.roll),
    );
    refit();
  }, [rotationDeg, refit]);

  const goToView = (view: StandardView): void => {
    const camera = cameraRef.current;
    if (!camera) return;
    applyStandardView(camera, view, radiusRef.current * 3);
    refit();
  };

  const setRotationAxis = (axis: keyof RotationDeg, value: number): void => {
    setRotationDeg((prev) => ({ ...prev, [axis]: value }));
  };

  if (initError) {
    return (
      <div className="viewport-container" role="alert">
        <p style={{ color: '#fff', padding: 16 }}>{initError}</p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="viewport-container"
        ref={containerRef}
        aria-label="3D model viewport"
        role="img"
      />
      <div
        role="group"
        aria-label="Standard views"
        style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}
      >
        {STANDARD_VIEWS.map((view) => (
          <button key={view} type="button" onClick={() => goToView(view)}>
            {view}
          </button>
        ))}
        <button type="button" onClick={() => goToView('front')}>
          Reset view
        </button>
      </div>
      {geometry && (
        <div
          role="group"
          aria-label="Straighten model"
          style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}
        >
          <p className="helper-text" style={{ margin: 0 }}>
            Not every import lands upright. Rotate the model itself (not just the view) to
            straighten it before generating a relief.
          </p>
          {(['roll', 'pitch', 'yaw'] as const).map((axis) => (
            <div key={axis} className="field" style={{ marginBottom: 0 }}>
              <label htmlFor={`rotate-${axis}`}>
                {axis[0]?.toUpperCase()}
                {axis.slice(1)} ({rotationDeg[axis]}°)
              </label>
              <input
                id={`rotate-${axis}`}
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotationDeg[axis]}
                onChange={(e) => setRotationAxis(axis, Number(e.target.value))}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setRotationDeg(ZERO_ROTATION)}
            style={{ alignSelf: 'flex-start' }}
          >
            Reset rotation
          </button>
        </div>
      )}
    </div>
  );
}
