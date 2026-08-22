import { useMemo } from 'react';
import type { HeightLevel } from '@/domain/types';
import { findSmallRegions } from '@/domain/regionCleanup';
import { minRegionPxForPreset, type MinRegionPreset } from '@/domain/pattern/minRegionPreset';

interface Props {
  levels: HeightLevel[];
  heightIndex: Int16Array;
  width: number;
  height: number;
  minRegionPreset: MinRegionPreset;
}

/** Height-levels stage: a per-level preview (pixel share) and a
 * small-region warning, per product spec §8/§15.
 *
 * As of Iteration 03 Round 1, this stage shows plain height bands only --
 * no needle-setting/calibration language. Needle-setting/calibration UI
 * was removed app-wide by explicit, reversible product decision (see
 * docs/ITERATION_03_PLAN.md #6 and docs/DECISIONS.md); the underlying
 * domain code (src/domain/calibration.ts) and CalibrationEditor.tsx are
 * untouched, just no longer reachable from the render tree. */
export function HeightStage({
  levels,
  heightIndex,
  width,
  height,
  minRegionPreset,
}: Props): JSX.Element {
  const counts = useMemo(() => {
    const c = new Array(levels.length).fill(0) as number[];
    for (const v of heightIndex) if (v >= 0) c[v] = (c[v] ?? 0) + 1;
    return c;
  }, [heightIndex, levels.length]);

  const minRegionPx = useMemo(
    () => minRegionPxForPreset(minRegionPreset, width, height),
    [minRegionPreset, width, height],
  );

  const smallRegions = useMemo(
    () => findSmallRegions(heightIndex, width, height, minRegionPx),
    [heightIndex, width, height, minRegionPx],
  );

  const totalForeground = counts.reduce((a, b) => a + b, 0) || 1;

  return (
    <section className="stage-panel" aria-labelledby="height-heading">
      <h2 id="height-heading">Height levels</h2>
      <p className="helper-text">
        The pattern uses {levels.length} distinct pile heights, low to high. Each row below shows
        how much of the pattern that height band covers.
      </p>

      <table className="legend-table">
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Share of pattern</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => {
            const share = ((counts[level.index] ?? 0) / totalForeground) * 100;
            return (
              <tr key={level.index}>
                <th scope="row">H{level.index + 1}</th>
                <td>{share.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {smallRegions.length > 0 && (
        <p role="alert" className="warning-banner">
          {smallRegions.length} region{smallRegions.length === 1 ? '' : 's'} are smaller than the
          minimum punchable size ({minRegionPx}px) and may be difficult to punch reliably. Consider
          raising the minimum region size or lowering the level count.
        </p>
      )}
    </section>
  );
}
