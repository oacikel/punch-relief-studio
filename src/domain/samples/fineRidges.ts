/**
 * Sample 4: thin radiating ridges over concentric rings -- deliberately
 * intricate, with a wide range of local feature widths (spike tips only a
 * few raster pixels across near the center, widening toward the rim; dense
 * concentric height bands from the ring wave), so it's a good stress test
 * for the needle-geometry width constraint
 * (src/domain/pattern/needleGeometry.ts, docs/ITERATION_04_PLAN.md) and for
 * general fine-detail handling -- unlike the other three samples, which are
 * deliberately simple/smooth.
 */
import { buildHeightFieldMesh, type MeshData } from './meshGrid';

export const FINE_RIDGES_SAMPLE_ID = 'sample-fine-ridges';

export function generateFineRidgesSample(resolution = 160, size = 10): MeshData {
  return buildHeightFieldMesh(resolution, size, (u, v) => {
    const r = Math.sqrt(u * u + v * v);
    if (r > 0.98) return 0;
    const angle = Math.atan2(v, u);
    const rings = 6;
    const ringWave = 0.5 + 0.5 * Math.sin(r * rings * Math.PI * 2);
    const spikeCount = 14;
    // cos^24 collapses each lobe to a narrow sliver -- the higher the
    // power, the thinner the raised ridge relative to the gaps between them.
    const spikeLobe = Math.pow(Math.max(0, Math.cos(angle * spikeCount)), 24);
    const base = (1 - r) * 0.4;
    return base + ringWave * 0.3 + spikeLobe * 0.6;
  });
}
