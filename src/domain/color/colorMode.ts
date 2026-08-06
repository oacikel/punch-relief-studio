/**
 * Assign a color index to every foreground pixel according to the active
 * ColorMode. Pure function of (mode, inputs) -> per-pixel color index, so
 * it's independent of how the color data was captured.
 */
import type { ColorMode, ColorSwatch, RgbColor } from '../types';

export interface ColorAssignment {
  swatches: ColorSwatch[];
  /** Color index per pixel, -1 for background. */
  colorIndex: Int16Array;
}

export function assignSingleColor(
  pixelCount: number,
  foregroundMask: Uint8Array,
  color: RgbColor,
  yarnName = 'Yarn 1',
): ColorAssignment {
  const colorIndex = new Int16Array(pixelCount).fill(-1);
  for (let i = 0; i < pixelCount; i++) {
    if (foregroundMask[i] === 1) colorIndex[i] = 0;
  }
  return { swatches: [{ index: 0, color, yarnName }], colorIndex };
}

export function assignColorByHeight(
  heightIndex: Int16Array,
  levelCount: number,
  colors: RgbColor[],
  yarnNames: string[],
): ColorAssignment {
  if (colors.length !== levelCount) {
    throw new Error(`Expected ${levelCount} colors for by-height mode, got ${colors.length}`);
  }
  const colorIndex = new Int16Array(heightIndex.length).fill(-1);
  for (let i = 0; i < heightIndex.length; i++) {
    const h = heightIndex[i] as number;
    colorIndex[i] = h; // by-height mode: color index === height index
  }
  const swatches: ColorSwatch[] = colors.map((color, i) => ({
    index: i,
    color,
    yarnName: yarnNames[i] ?? `Yarn ${i + 1}`,
  }));
  return { swatches, colorIndex };
}

export function describeColorMode(mode: ColorMode): string {
  switch (mode) {
    case 'single':
      return 'The entire pattern uses one editable yarn color.';
    case 'by-height':
      return 'Each pile-height level gets its own yarn color.';
    case 'source-material':
      return 'Colors are captured from the model’s surface and reduced to a yarn palette.';
  }
}
