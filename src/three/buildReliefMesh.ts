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
export function buildReliefGeometry(regionMap: RegionMap, options: ReliefMeshOptions): THREE.BufferGeometry {
  const { width, height } = regionMap;
  const geometry = new THREE.PlaneGeometry(options.widthCm, options.heightCm, width - 1, height - 1);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const step = options.fallbackHeightPerLevelCm ?? DEFAULT_FALLBACK_STEP_CM;

  for (let i = 0; i < position.count; i++) {
    const col = i % width;
    const row = Math.floor(i / width);
    const flippedRow = height - 1 - row; // PlaneGeometry rows run bottom-to-top
    const idx = flippedRow * width + col;
    const h = regionMap.heightIndex[idx] as number;
    const y = h === -1 ? 0 : heightForLevel(h, options.levels, options.profile, step);
    position.setY(i, y);
  }
  position.needsUpdate = true;
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
