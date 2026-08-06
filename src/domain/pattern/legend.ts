/**
 * Build the legend data relating color IDs, yarn names, height IDs, and
 * needle settings -- the single source of truth the pattern canvas, PDF
 * export, and on-screen legend all render from, so they can never disagree.
 */
import type { CalibrationProfile } from '../calibration';
import { mapHeightLevelToSetting } from '../calibration';
import { regionId, symbolForHeight } from '../regionId';
import type { ColorSwatch, HeightLevel } from '../types';

export interface LegendEntry {
  id: string; // "C1-H2"
  colorIndex: number;
  heightIndex: number;
  symbol: string;
  color: string; // css hex, or 'none' for height-only regions
  yarnName: string;
  needleSettingLabel: string;
  needleSettingNumber: number;
  measuredHeightCm: number | null;
}

export function buildLegend(
  swatches: ColorSwatch[],
  levels: HeightLevel[],
  profile: CalibrationProfile,
): LegendEntry[] {
  const entries: LegendEntry[] = [];
  for (const level of levels) {
    const setting = mapHeightLevelToSetting(level.index, levels.length, profile);
    for (const swatch of swatches) {
      entries.push({
        id: regionId(swatch.index, level.index),
        colorIndex: swatch.index,
        heightIndex: level.index,
        symbol: symbolForHeight(level.index),
        color: rgbToHex(swatch.color),
        yarnName: swatch.yarnName,
        needleSettingLabel: setting.label,
        needleSettingNumber: setting.settingNumber,
        measuredHeightCm: setting.measuredHeightCm,
      });
    }
  }
  return entries;
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const toHex = (c: number): string => c.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
