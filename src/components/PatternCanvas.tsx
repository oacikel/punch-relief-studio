import { useEffect, useMemo, useState } from 'react';
import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import { buildSvgPattern, type PatternView } from '@/export/svgPattern';

interface Props {
  regionMap: RegionMap;
  legend: LegendEntry[];
  view: PatternView;
  widthCm: number;
  heightCm: number;
  showGrid: boolean;
  mirrored: boolean;
}

/**
 * Renders the composed pattern SVG as an <img> from a blob URL, rather than
 * injecting markup into the DOM directly (no dangerouslySetInnerHTML
 * anywhere in this app, per CLAUDE.md/security constraints, even though
 * this SVG is entirely app-generated from numeric data and never contains
 * user-supplied text).
 */
export function PatternCanvas({
  regionMap,
  legend,
  view,
  widthCm,
  heightCm,
  showGrid,
  mirrored,
}: Props): JSX.Element {
  const result = useMemo(
    () =>
      buildSvgPattern(regionMap, legend, {
        widthCm,
        heightCm,
        view,
        showGrid,
        showLabels: true,
        mirrored,
      }),
    [regionMap, legend, view, widthCm, heightCm, showGrid, mirrored],
  );
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result.svg]);

  return (
    <img
      src={url ?? undefined}
      alt={`Punch-needle pattern, ${view} view, ${widthCm} by ${heightCm} centimetres`}
      style={{
        width: '100%',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        background: '#f7f3ec',
      }}
    />
  );
}
