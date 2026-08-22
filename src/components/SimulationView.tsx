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

/**
 * Finished-piece simulation: builds a displaced-plane relief mesh from the
 * *processed* region map (never the raw import), with a yarn-like rough
 * material and directional lighting so the stepped pile heights read
 * clearly. Explicitly labeled "Simulation" per product spec §12 -- this is
 * never allowed to look like a literal photo of the source model.
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 480;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(renderSettings.fabricColorHex);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 200);
    const maxSpan = Math.max(widthCm, heightCm);
    camera.position.set(maxSpan * 0.6, maxSpan * 0.7, maxSpan * 0.9);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const az = THREE.MathUtils.degToRad(renderSettings.lightingAzimuthDeg);
    const el = THREE.MathUtils.degToRad(renderSettings.lightingElevationDeg);
    const light = new THREE.DirectionalLight(0xfff2e0, 1.3);
    light.position
      .set(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el))
      .multiplyScalar(maxSpan);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const geometry = buildReliefGeometry(regionMap, {
      widthCm,
      heightCm,
      levels,
      profile,
      legend,
    });
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: renderSettings.pileStyle === 'loop' ? 0.95 : 0.75,
      flatShading: renderSettings.pileStyle === 'cut',
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const fabric = new THREE.Mesh(
      new THREE.PlaneGeometry(widthCm * 1.4, heightCm * 1.4),
      new THREE.MeshStandardMaterial({ color: renderSettings.fabricColorHex, roughness: 1 }),
    );
    fabric.rotateX(-Math.PI / 2);
    fabric.position.y = -0.01;
    fabric.receiveShadow = true;
    scene.add(fabric);

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
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [regionMap, levels, profile, widthCm, heightCm, renderSettings, legend]);

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
