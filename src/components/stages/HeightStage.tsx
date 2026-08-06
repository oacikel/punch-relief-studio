import { useMemo } from 'react';
import type { HeightLevel } from '@/domain/types';
import { mapHeightLevelToSetting, type CalibrationProfile } from '@/domain/calibration';
import { findSmallRegions } from '@/domain/regionCleanup';

interface Props {
  levels: HeightLevel[];
  heightIndex: Int16Array;
  width: number;
  height: number;
  minRegionPx: number;
  profile: CalibrationProfile;
}

/** Height-levels stage: a per-level preview (pixel share + needle setting)
 * and a small-region warning, per product spec §8/§15. */
export function HeightStage({ levels, heightIndex, width, height, minRegionPx, profile }: Props): JSX.Element {
  const counts = useMemo(() => {
    const c = new Array(levels.length).fill(0) as number[];
    for (const v of heightIndex) if (v >= 0) c[v] = (c[v] ?? 0) + 1;
    return c;
  }, [heightIndex, levels.length]);

  const smallRegions = useMemo(
    () => findSmallRegions(heightIndex, width, height, minRegionPx),
    [heightIndex, width, height, minRegionPx],
  );

  const totalForeground = counts.reduce((a, b) => a + b, 0) || 1;

  return (
    <section className="stage-panel" aria-labelledby="height-heading">
      <h2 id="height-heading">Height levels</h2>
      <p className="helper-text">
        Each level below maps to a needle setting from your calibration profile. Uncalibrated
        settings show relative order only -- not a real measurement.
      </p>
      <table className="legend-table">
        <thead>
          <tr>
            <th scope="col">Level</th>
            <th scope="col">Share of pattern</th>
            <th scope="col">Needle setting</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((level) => {
            const setting = mapHeightLevelToSetting(level.index, levels.length, profile);
            const share = ((counts[level.index] ?? 0) / totalForeground) * 100;
            return (
              <tr key={level.index}>
                <th scope="row">H{level.index + 1}</th>
                <td>{share.toFixed(1)}%</td>
                <td>
                  {setting.settingNumber}: {setting.label}
                  {setting.measuredHeightCm !== null ? ` (${setting.measuredHeightCm.toFixed(2)}cm)` : ' (uncalibrated)'}
                </td>
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
