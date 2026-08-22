import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CalibrationProfile } from '@/domain/calibration';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { HeightLevel, RegionMap } from '@/domain/types';
import { buildReliefGeometry } from '@/three/buildReliefMesh';
import type { RenderSettings } from '@/state/appState';

interface Props {
  regionMap: RegionMap;
  levels: HeightLevel[];
  profile: CalibrationProfile;
  widthCm: number;
  heightCm: number;
  renderSettings: RenderSettings;
  /** The same region legend the 2D pattern and on-screen Legend table
   * render from -- drives real per-region yarn color in the simulation
   * mesh (docs/ITERATION_03_PLAN.md #10) instead of a flat placeholder. */
  legend: LegendEntry[];
}

type SimulationMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/**
 * Finished-piece simulation: builds a displaced-plane relief mesh from the
 * *processed* region map (never the raw import), with a yarn-like rough
 * material and directional lighting so the stepped pile heights read
 * clearly. Explicitly labeled "Simulation" per product spec §12 -- this is
 * never allowed to look like a literal photo of the source model.
 *
 * As of Iteration 03 Round 1, scene setup is split into three effects
 * (mirroring the split `Viewport3D.tsx` already uses) rather than one
 * mega-effect that rebuilt the entire scene -- including the camera and
 * `OrbitControls` -- on every prop change. Previously, dragging the
 * lighting-direction slider (part of the single `renderSettings` object)
 * discarded whatever camera orbit the user had just set, since
 * `renderSettings` bundles `pileStyle`/`fabricColorHex` together with
 * `lightingAzimuthDeg`/`lightingElevationDeg` (docs/ITERATION_03_PLAN.md
 * #8):
 *
 * 1. Mount effect (deps `[]`): creates the renderer/scene/camera/
 *    `OrbitControls`/lights/materials exactly once, starts the render
 *    loop. Never reruns for the lifetime of the component.
 * 2. Geometry effect (deps: regionMap/levels/profile/widthCm/heightCm/
 *    legend): rebuilds the relief mesh's geometry and the fabric-plane
 *    geometry, and re-frames the camera for the (possibly new) physical
 *    dimensions -- the same "geometry/camera-affecting props" pairing
 *    `Viewport3D.tsx`'s own geometry effect uses. Never touches
 *    `OrbitControls` itself, so a fresh regionMap doesn't fight a
 *    concurrent user drag.
 * 3. Light/material effect (deps: renderSettings.pileStyle/
 *    fabricColorHex/lightingAzimuthDeg/lightingElevationDeg, plus
 *    widthCm/heightCm since light *distance* -- not just direction --
 *    scales with the pattern's physical size): updates the directional
 *    light's position and the mesh/fabric material properties in place.
 *    Never touches the camera, `OrbitControls`, or geometry -- this is
 *    the fix for the reported bug.
 */
export function SimulationView({
  regionMap,
  levels,
  profile,
  widthCm,
  heightCm,
  renderSettings,
  legend,
}: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const lightRef = useRef<THREE.DirectionalLight | null>(null);
  const meshRef = useRef<SimulationMesh | null>(null);
  const fabricRef = useRef<SimulationMesh | null>(null);

  // Mount effect: create the renderer/scene/camera/controls/lights/
  // materials exactly once and start the render loop. Deliberately empty
  // deps -- everything reactive to prop changes lives in the two effects
  // below, which mutate these same objects in place rather than
  // recreating them.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    camera.position.set(6, 7, 9);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const light = new THREE.DirectionalLight(0xfff2e0, 1.3);
    scene.add(light);
    lightRef.current = light;
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Persistent materials, mutated (never recreated) by the light/
    // material effect below.
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material) as SimulationMesh;
    scene.add(mesh);
    meshRef.current = mesh;

    const fabricMaterial = new THREE.MeshStandardMaterial({ roughness: 1 });
    const fabric = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fabricMaterial) as SimulationMesh;
    fabric.rotateX(-Math.PI / 2);
    fabric.position.y = -0.01;
    fabric.receiveShadow = true;
    scene.add(fabric);
    fabricRef.current = fabric;

    let frame = 0;
    const animate = (): void => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      mesh.geometry.dispose();
      material.dispose();
      fabric.geometry.dispose();
      fabricMaterial.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Geometry effect: rebuild the relief mesh and fabric-plane geometry,
  // and re-frame the camera for the (possibly new) physical dimensions.
  // Never touches OrbitControls.
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const mesh = meshRef.current;
    const fabric = fabricRef.current;
    if (!scene || !camera || !mesh || !fabric) return;

    const geometry = buildReliefGeometry(regionMap, {
      widthCm,
      heightCm,
      levels,
      profile,
      legend,
    });
    mesh.geometry.dispose();
    mesh.geometry = geometry;

    const fabricGeometry = new THREE.PlaneGeometry(widthCm * 1.4, heightCm * 1.4);
    fabric.geometry.dispose();
    fabric.geometry = fabricGeometry;

    const maxSpan = Math.max(widthCm, heightCm);
    camera.position.set(maxSpan * 0.6, maxSpan * 0.7, maxSpan * 0.9);
    camera.lookAt(0, 0, 0);
  }, [regionMap, levels, profile, widthCm, heightCm, legend]);

  // Light/material effect: reposition the directional light and update
  // material properties in place. Never touches the camera, controls, or
  // geometry -- this is what stops the lighting slider (and pile-style/
  // fabric-color changes) from discarding the user's camera orbit
  // (docs/ITERATION_03_PLAN.md #8). widthCm/heightCm are included here
  // too, alongside the geometry effect, because light *distance* (not
  // just direction) scales with maxSpan -- without this, changing the
  // pattern's physical size without touching a lighting slider would
  // leave the light positioned for the old size.
  useEffect(() => {
    const scene = sceneRef.current;
    const light = lightRef.current;
    const mesh = meshRef.current;
    const fabric = fabricRef.current;
    if (!scene || !light || !mesh || !fabric) return;

    scene.background = new THREE.Color(renderSettings.fabricColorHex);

    const maxSpan = Math.max(widthCm, heightCm);
    const az = THREE.MathUtils.degToRad(renderSettings.lightingAzimuthDeg);
    const el = THREE.MathUtils.degToRad(renderSettings.lightingElevationDeg);
    light.position
      .set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el))
      .multiplyScalar(maxSpan);

    mesh.material.roughness = renderSettings.pileStyle === 'loop' ? 0.95 : 0.75;
    mesh.material.flatShading = renderSettings.pileStyle === 'cut';
    mesh.material.needsUpdate = true;

    fabric.material.color.set(renderSettings.fabricColorHex);
  }, [
    renderSettings.pileStyle,
    renderSettings.fabricColorHex,
    renderSettings.lightingAzimuthDeg,
    renderSettings.lightingElevationDeg,
    widthCm,
    heightCm,
  ]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="viewport-container"
        ref={containerRef}
        role="img"
        aria-label="Finished-piece simulation"
      />
      <span className="simulation-label">Simulation -- not a photo</span>
    </div>
  );
}
