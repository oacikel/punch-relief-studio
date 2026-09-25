export interface PatternDimensionsValue {
  widthCm: number;
  heightCm: number;
  lockAspect: boolean;
}

export type PatternDimensionAxis = 'width' | 'height';

/**
 * Resize one physical axis while preserving the current aspect ratio when
 * requested. Kept in the domain layer because physical size participates in
 * needle-width cleanup; it is not merely export presentation state.
 */
export function resizePatternDimensions(
  current: PatternDimensionsValue,
  axis: PatternDimensionAxis,
  nextCm: number,
): Partial<PatternDimensionsValue> | null {
  if (!Number.isFinite(nextCm) || nextCm <= 0) return null;

  if (!current.lockAspect) return axis === 'width' ? { widthCm: nextCm } : { heightCm: nextCm };

  if (axis === 'width') {
    if (!(current.widthCm > 0)) return { widthCm: nextCm };
    return {
      widthCm: nextCm,
      heightCm: (nextCm / current.widthCm) * current.heightCm,
    };
  }

  if (!(current.heightCm > 0)) return { heightCm: nextCm };
  return {
    widthCm: (nextCm / current.heightCm) * current.widthCm,
    heightCm: nextCm,
  };
}
