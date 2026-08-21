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
  onCalibrate: () => void;
}

/** Height-levels stage: a per-level preview (pixel share + needle setting)
 * and a small-region warning, per product spec §8/§15.
 *
 * As of Iteration 02 Stage B, this stage also owns the app's contextual
 * entry point into calibration (docs/ITERATION_02_PLAN.md §14 decision
 * #1): calibration itself still lives in Preview's compact "Export &
 * print" panel (unchanged since Stage A), but a "Calibrate needle
 * settings" link here jumps straight there and opens/scrolls to it, since
 * this is the stage where an uncalibrated profile's limits are most
 * visible (every row below shows relative order only until the user
 * calibrates). See src/App.tsx's `onCalibrate` wiring. */
export function HeightStage({
  levels,
  heightIndex,
  width,
  height,
  minRegionPx,
  profile,
  onCalibrate,
}: Props): JSX.Element {
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

      <p className="helper-text">
        Profile: <strong>{profile.profileName}</strong> --{' '}
        <span>
          {profile.calibrated ? 'calibrated' : 'not yet calibrated (relative order only)'}
        </span>
        .
      </p>
      <button type="button" onClick={onCalibrate}>
        Calibrate needle settings &rarr;
      </button>

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
                  {setting.measuredHeightCm !== null
                    ? ` (${setting.measuredHeightCm.toFixed(2)}cm)`
                    : ' (uncalibrated)'}
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
