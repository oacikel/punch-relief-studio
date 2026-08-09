import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { PatternView } from '@/export/svgPattern';
import { usePatternSvgUrl } from '@/hooks/usePatternSvgUrl';

interface Props {
  regionMap: RegionMap;
  legend: LegendEntry[];
  view: PatternView;
  widthCm: number;
  heightCm: number;
  showGrid: boolean;
  showLabels: boolean;
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
  showLabels,
  mirrored,
}: Props): JSX.Element {
  const { url } = usePatternSvgUrl(
    regionMap,
    legend,
    widthCm,
    heightCm,
    view,
    showGrid,
    showLabels,
    mirrored,
  );

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
