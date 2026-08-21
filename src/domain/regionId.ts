/**
 * Combined color+height region identity. The product must never rely on
 * color alone (accessibility requirement), so every region on the pattern,
 * legend, and exports is labeled with a stable "C{n}-H{n}" style ID in
 * addition to (or instead of) a color swatch.
 */

export function regionId(colorIndex: number, heightIndex: number): string {
  const c = colorIndex >= 0 ? `C${colorIndex + 1}` : 'C-';
  const h = heightIndex >= 0 ? `H${heightIndex + 1}` : 'H-';
  return `${c}-${h}`;
}

export function parseRegionId(id: string): { colorIndex: number; heightIndex: number } | null {
  const match = /^C(-|\d+)-H(-|\d+)$/.exec(id);
  if (!match) return null;
  const [, c, h] = match;
  return {
    colorIndex: c === '-' ? -1 : Number(c) - 1,
    heightIndex: h === '-' ? -1 : Number(h) - 1,
  };
}

/** Distinct small-multiple symbols (not just numbers) so printed
 * grayscale/colorblind-safe legends stay distinguishable at a glance --
 * cycles through a fixed deterministic set keyed by height index. Sized to
 * 12 entries (not 8) so it covers the full widened height-levels range
 * (2-12, see docs/DECISIONS.md) without two levels sharing a symbol word
 * before the cycle wraps -- CLAUDE.md requires pairing every region with a
 * symbol/ID, not just a color, so a premature wrap here would silently
 * undercut that for any pattern using more than 8 levels. */
const HEIGHT_SYMBOLS = [
  'circle',
  'triangle',
  'square',
  'diamond',
  'star',
  'inverted-triangle',
  'pentagon',
  'cross',
  'hexagon',
  'plus',
  'asterisk',
  'ring',
] as const;

export function symbolForHeight(heightIndex: number): string {
  return HEIGHT_SYMBOLS[heightIndex % HEIGHT_SYMBOLS.length] ?? 'circle';
}
