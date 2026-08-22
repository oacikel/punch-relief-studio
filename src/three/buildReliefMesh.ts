/**
 * Build the finished-piece simulation mesh from the *processed* (quantized,
 * cleaned-up) region map -- never from the raw imported mesh. This is what
 * makes the simulation an honest preview of manufacturing loss: it can only
 * show what the pattern itself encodes.
 */
import * as THREE from 'three';
import type { CalibrationProfile } from '@/domain/calibration';
import { mapHeightLevelToSetting } from '@/domain/calibration';
import type { HeightLevel, RegionMap } from '@/domain/types';

export interface ReliefMeshOptions {
  widthCm: number;
  heightCm: number;
  levels: HeightLevel[];
  profile: CalibrationProfile;
  /** Fallback pile height (cm) per level index when the profile has no
   * measurement -- keeps the relative relief visible even uncalibrated. */
  fallbackHeightPerLevelCm?: number;
}

const DEFAULT_FALLBACK_STEP_CM = 0.25;

/**
 * Displacement is looked up per-vertex from the region map's height index
 * (nearest-pixel sample), producing a stepped, faceted-but-smoothed relief
 * that matches what the pattern actually specifies -- not the original
 * mesh's continuous surface.
 */
export function buildReliefGeometry(
  regionMap: RegionMap,
  options: ReliefMeshOptions,
): THREE.BufferGeometry {
  const { width, height } = regionMap;
  const geometry = new THREE.PlaneGeometry(
    options.widthCm,
    options.heightCm,
    width - 1,
    height - 1,
  );
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const step = options.fallbackHeightPerLevelCm ?? DEFAULT_FALLBACK_STEP_CM;
  // Per-vertex foreground flag -- background (heightIndex === -1) vertices
  // get y=0 same as before, but see below: any triangle touching one of
  // them is dropped from the index, so they end up unreferenced/unrendered
  // rather than forming a solid zero-height slab under the model.
  const isForeground = new Uint8Array(position.count);

  for (let i = 0; i < position.count; i++) {
    const col = i % width;
    const row = Math.floor(i / width);
    const flippedRow = height - 1 - row; // PlaneGeometry rows run bottom-to-top
    const idx = flippedRow * width + col;
    const h = regionMap.heightIndex[idx] as number;
    if (h === -1) {
      isForeground[i] = 0;
      position.setY(i, 0);
    } else {
      isForeground[i] = 1;
      position.setY(i, heightForLevel(h, options.levels, options.profile, step));
    }
  }
  position.needsUpdate = true;

  // Exclude background from the mesh entirely (a real gap, not a filled
  // slab) -- see docs/ITERATION_03_PLAN.md #9. PlaneGeometry's index
  // buffer connects every adjacent quad regardless of foreground/
  // background, so drop any triangle that references a background vertex.
  // Passing a plain JS array back into setIndex() lets Three.js pick the
  // correctly-sized typed array (Uint16 vs Uint32) for the resulting
  // vertex count, same as it does for the original auto-generated index.
  const index = geometry.getIndex();
  if (index) {
    const kept: number[] = [];
    for (let f = 0; f < index.count; f += 3) {
      const a = index.getX(f);
      const b = index.getX(f + 1);
      const c = index.getX(f + 2);
      if (isForeground[a] && isForeground[b] && isForeground[c]) kept.push(a, b, c);
    }
    geometry.setIndex(kept);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function heightForLevel(
  levelIndex: number,
  levels: HeightLevel[],
  profile: CalibrationProfile,
  fallbackStepCm: number,
): number {
  const setting = mapHeightLevelToSetting(levelIndex, levels.length, profile);
  if (setting.measuredHeightCm !== null) return setting.measuredHeightCm;
  return (levelIndex + 1) * fallbackStepCm;
}
