import type { RegionMap } from '@/domain/types';
import type { LegendEntry } from '@/domain/pattern/legend';
import type { ContourSource, PatternView } from '@/export/svgPattern';
import type { PunchGuideSettings } from '@/domain/pattern/punchGuide';
import { usePatternSvgUrl } from '@/hooks/usePatternSvgUrl';
import { PatternPreview } from '@/components/PatternPreview';

interface Props {
  regionMap: RegionMap;
  legend: LegendEntry[];
  view: PatternView;
  widthCm: number;
  heightCm: number;
  showGrid: boolean;
  showLabels: boolean;
  mirrored: boolean;
  contourSource?: ContourSource;
  /** Iteration 02 Stage C: optional dot-grid placement guide, shared with
   * whatever export/print path renders the same pattern. */
  punchGuide?: PunchGuideSettings;
}

/**
 * Renders the composed pattern SVG as an <img> from a blob URL, rather than
 * injecting markup into the DOM directly (no dangerouslySetInnerHTML
 * anywhere in this app, per CLAUDE.md/security constraints, even though
 * this SVG is entirely app-generated from numeric data and never contains
 * user-supplied text). The `<img>` itself lives inside `PatternPreview`
 * (EXP-007 -- see docs/ANALYTICS.md), which opens fit-to-screen and adds
 * pan/pinch/scroll zoom on top of it; this component's own job is still
 * just building the blob URL from `regionMap`/`legend`/the display options.
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
  contourSource,
  punchGuide,
}: Props): JSX.Element {
  // exactOptionalPropertyTypes forbids assigning `undefined` to an
  // optional field -- omit `punchGuide` entirely when this component
  // wasn't given one, rather than setting it to undefined (see the same
  // pattern in App.tsx's handleSaveProjectJson).
  const { url } = usePatternSvgUrl(regionMap, legend, {
    widthCm,
    heightCm,
    view,
    showGrid,
    showLabels,
    mirrored,
    ...(contourSource ? { contourSource } : {}),
    ...(punchGuide ? { punchGuide } : {}),
  });

  return (
    <PatternPreview
      src={url}
      alt={`Punch-needle pattern, ${view} view, ${widthCm} by ${heightCm} centimetres`}
    />
  );
}
