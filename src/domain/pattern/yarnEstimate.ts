/**
 * Approximate yarn-usage estimate. Explicitly an estimate -- documents its
 * own assumptions in the returned object so the UI/export can show them
 * verbatim rather than presenting a bare number as fact.
 */
import type { CalibrationProfile, NeedleSetting } from '../calibration';
import type { Cm } from '../units';

export interface YarnEstimateInput {
  regionAreaCm2: number;
  heightLevelIndex: number;
  levelCount: number;
  profile: CalibrationProfile;
  /** Loops per linear cm of punching, a rough density constant -- see
   * assumptions in the result. Defaults to a typical worsted-weight value. */
  loopsPerCm?: number;
}

export interface YarnEstimateResult {
  meters: number;
  assumptions: string[];
}

const DEFAULT_LOOPS_PER_CM = 2.5;
const DEFAULT_PILE_HEIGHT_CM = 0.8; // used only when the profile has no measurement

export function estimateYarnForRegion(input: YarnEstimateInput): YarnEstimateResult {
  const loopsPerCm = input.loopsPerCm ?? DEFAULT_LOOPS_PER_CM;
  const setting = pickSetting(input.heightLevelIndex, input.levelCount, input.profile);
  const pileHeightCm = setting.measuredHeightCm ?? DEFAULT_PILE_HEIGHT_CM;

  // Each square cm of fabric holds roughly loopsPerCm^2 loops; each loop
  // consumes about 2x the pile height (up and back through the fabric).
  const loopsPerCm2 = loopsPerCm * loopsPerCm;
  const cmPerLoop = pileHeightCm * 2;
  const totalCm = input.regionAreaCm2 * loopsPerCm2 * cmPerLoop;

  const assumptions = [
    `Loop density assumed at ${loopsPerCm.toFixed(1)} loops/cm in both directions (${loopsPerCm2.toFixed(1)} loops/cm²).`,
    setting.measuredHeightCm !== null
      ? `Pile height ${pileHeightCm.toFixed(2)}cm from calibration profile "${input.profile.profileName}", setting ${setting.settingNumber}.`
      : `Pile height not calibrated -- using a generic placeholder of ${DEFAULT_PILE_HEIGHT_CM}cm. Calibrate this profile for a realistic estimate.`,
    'Each loop assumed to use twice the pile height in yarn (up and back through the fabric); does not include take-up for tension or waste.',
    'This is a rough planning estimate, not a purchasing guarantee -- buy a margin of extra yarn.',
  ];

  return { meters: totalCm / 100, assumptions };
}

function pickSetting(heightLevelIndex: number, levelCount: number, profile: CalibrationProfile): NeedleSetting {
  const settings = [...profile.settings].sort((a, b) => a.settingNumber - b.settingNumber);
  const ratio = heightLevelIndex / Math.max(1, levelCount - 1);
  const idx = Math.round(ratio * (settings.length - 1));
  return settings[Math.min(settings.length - 1, Math.max(0, idx))] as NeedleSetting;
}

export function pxToCm2(areaPx: number, pxPerCm: number): number {
  return areaPx / (pxPerCm * pxPerCm);
}
