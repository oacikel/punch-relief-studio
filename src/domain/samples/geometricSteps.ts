/**
 * Sample 3: simple geometric step block -- concentric square terraces with
 * hard, unambiguous height boundaries, to make quantization level
 * boundaries easy to visually inspect and to sanity check edge preservation.
 */
import { buildHeightFieldMesh, type MeshData } from './meshGrid';

export const GEOMETRIC_STEPS_SAMPLE_ID = 'sample-geometric-steps';

export function generateGeometricStepsSample(resolution = 96, size = 10): MeshData {
  return buildHeightFieldMesh(resolution, size, (u, v) => {
    const d = Math.max(Math.abs(u), Math.abs(v)); // Chebyshev distance -> square terraces
    if (d > 0.95) return 0;
    const steps = 4;
    const stepIndex = Math.min(steps - 1, Math.floor((1 - d) * steps));
    return (stepIndex / (steps - 1)) * 1.2;
  });
}
