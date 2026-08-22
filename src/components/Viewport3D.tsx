import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { captureDepth, type DepthCaptureResult } from '@/three/depthCapture';
import {
  applyStandardView,
  centerAndMeasure,
  fitOrthographicCamera,
  normalizeScale,
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
  const [initError, setInitError] = useState<string | null>(null);
  // Local component state, deliberately not lifted to AppState -- mirrors
  // how the existing camera-view state already persists across Import <->
  // Relief navigation today: this Viewport3D instance is never remounted
  // between those two stages (see e2e/orient-persistence.spec.ts), so
  // local state survives the same way, with no schema/persistence changes
  // needed.
  const [rotationDeg, setRotationDeg] = useState<RotationDeg>(ZERO_ROTATION);

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
        return captureDepth(renderer, scene, camera, {
          width: resolution,
          height: resolution,
          captureColor,
        });
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      const currentCamera = cameraRef.current;
      if (currentCamera) fitOrthographicCamera(currentCamera, radiusRef.current, 1.15, w / h);
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

    const container = containerRef.current;
    const aspect =
      container && container.clientHeight ? container.clientWidth / container.clientHeight : 1;
    fitOrthographicCamera(camera, radiusRef.current, 1.15, aspect);
    applyStandardView(camera, 'front', radiusRef.current * 3);
  }, [geometry]);

  // Apply the model-straightening rotation to the mesh in place -- no
  // geometry rebuild, no camera/controls change, so dragging a rotation
  // slider never fights an in-progress orbit drag or resets framing.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.set(
      THREE.MathUtils.degToRad(rotationDeg.pitch),
      THREE.MathUtils.degToRad(rotationDeg.yaw),
      THREE.MathUtils.degToRad(rotationDeg.roll),
    );
  }, [rotationDeg]);

  const goToView = (view: StandardView): void => {
    const camera = cameraRef.current;
    if (!camera) return;
    applyStandardView(camera, view, radiusRef.current * 3);
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
