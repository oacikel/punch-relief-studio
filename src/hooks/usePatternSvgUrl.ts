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
import {
  buildSvgPattern,
  type SvgPatternOptions,
  type SvgPatternResult,
} from '@/export/svgPattern';

/**
 * Iteration 02 Stage C: takes a single `SvgPatternOptions` object rather
 * than positional args -- adding the `punchGuide` option on top of the
 * existing view/showGrid/showLabels/mirrored primitives would have made an
 * already-long positional call signature (this hook had 6 primitive
 * params beyond regionMap/legend) worse. `SvgPatternOptions` already names
 * exactly these fields, so this removes a parallel, duplicate parameter
 * list rather than adding to it.
 */
export function usePatternSvgUrl(
  regionMap: RegionMap,
  legend: LegendEntry[],
  options: SvgPatternOptions,
): { url: string | null; result: SvgPatternResult } {
  const { widthCm, heightCm, view, showGrid, showLabels, mirrored, pxPerCm, punchGuide } = options;
  // Passing `options` straight through (rather than rebuilding a literal
  // from the destructured fields) avoids explicitly writing `pxPerCm:
  // undefined`/`punchGuide: undefined` into the object when a caller omits
  // them -- this project's `exactOptionalPropertyTypes: true` treats an
  // explicit `undefined` on an optional field differently from the key
  // being absent altogether.
  // Depend on the individual primitive/object fields, not the `options`
  // object's own identity, so callers can pass a fresh object literal each
  // render without defeating this memo.
  const result = useMemo(
    () => buildSvgPattern(regionMap, legend, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      regionMap,
      legend,
      widthCm,
      heightCm,
      view,
      showGrid,
      showLabels,
      mirrored,
      pxPerCm,
      punchGuide,
    ],
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
