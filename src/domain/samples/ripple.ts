/**
 * Sample 1: concentric sinusoidal ripple / radial wave. Exercises smooth
 * gradients and clean concentric height boundaries once quantized.
 */
import { buildHeightFieldMesh, type MeshData } from './meshGrid';

export const RIPPLE_SAMPLE_ID = 'sample-ripple';

export function generateRippleSample(resolution = 96, size = 10): MeshData {
  return buildHeightFieldMesh(resolution, size, (u, v) => {
    const r = Math.sqrt(u * u + v * v);
    const wave = Math.cos(r * Math.PI * 3.5) * 0.5 + 0.5;
    const falloff = Math.max(0, 1 - r * 1.05);
    return wave * falloff * 1.2;
  });
}
