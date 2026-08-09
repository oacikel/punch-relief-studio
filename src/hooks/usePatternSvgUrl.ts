/**
 * Builds the composed pattern SVG and manages it as a blob URL (revoked on
 * cleanup/change) so callers can render it via <img src>, rather than
 * injecting markup into the DOM directly -- no dangerouslySetInnerHTML
 * anywhere in this app, per CLAUDE.md, even though this SVG is entirely
 * app-generated from numeric data and never contains user-supplied text.
 */
import { useEffect, useMemo, useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import { buildSvgPattern, type PatternView, type SvgPatternResult } from '@/export/svgPattern';

export function usePatternSvgUrl(
  regionMap: RegionMap,
  legend: LegendEntry[],
  widthCm: number,
  heightCm: number,
  view: PatternView,
  showGrid: boolean,
  showLabels: boolean,
  mirrored: boolean,
): { url: string | null; result: SvgPatternResult } {
  const result = useMemo(
    () =>
      buildSvgPattern(regionMap, legend, {
        widthCm,
        heightCm,
        view,
        showGrid,
        showLabels,
        mirrored,
      }),
    [regionMap, legend, widthCm, heightCm, view, showGrid, showLabels, mirrored],
  );
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result.svg]);

  return { url, result };
}
