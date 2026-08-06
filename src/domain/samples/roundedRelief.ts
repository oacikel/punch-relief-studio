/**
 * Sample 2: rounded, eye-like curved relief -- a recognizable organic
 * shape (two overlapping domes forming a lens/eye silhouette) to sanity
 * check that smoothing and quantization preserve a legible form.
 */
import { buildHeightFieldMesh, type MeshData } from './meshGrid';

export const ROUNDED_RELIEF_SAMPLE_ID = 'sample-rounded-relief';

export function generateRoundedReliefSample(resolution = 96, size = 10): MeshData {
  return buildHeightFieldMesh(resolution, size, (u, v) => {
    const lensWidth = 0.85;
    const lensHeight = 0.45;
    const eyeShape = 1 - (u * u) / (lensWidth * lensWidth) - (v * v) / (lensHeight * lensHeight);
    if (eyeShape <= 0) return 0;
    const dome = Math.sqrt(eyeShape) * 1.4;
    // Small raised "pupil" bump for a second, smaller height band.
    const pupilDist = Math.sqrt((u - 0.05) ** 2 + (v * 1.6) ** 2);
    const pupil = Math.max(0, 1 - pupilDist / 0.22) * 0.5;
    return dome + pupil;
  });
}
