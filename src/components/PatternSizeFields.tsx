import { DecimalNumberInput } from '@/components/DecimalNumberInput';
import { resizePatternDimensions } from '@/domain/pattern/patternDimensions';
import type { PatternDimensions } from '@/state/appState';

interface Props {
  dimensions: PatternDimensions;
  onChange: (patch: Partial<PatternDimensions>) => void;
  idPrefix: string;
  showShapeExplanation?: boolean;
}

export function PatternSizeFields({
  dimensions,
  onChange,
  idPrefix,
  showShapeExplanation = false,
}: Props): JSX.Element {
  const changeAxis = (axis: 'width' | 'height', nextCm: number | null): void => {
    if (nextCm === null) return;
    const patch = resizePatternDimensions(dimensions, axis, nextCm);
    if (patch) onChange(patch);
  };

  return (
    <div className="pattern-size-fields">
      <div className="field-row">
        <div className="field">
          <label htmlFor={`${idPrefix}-width-cm`}>Width (cm)</label>
          <DecimalNumberInput
            id={`${idPrefix}-width-cm`}
            value={dimensions.widthCm}
            onChange={(value) => changeAxis('width', value)}
          />
        </div>
        <div className="field">
          <label htmlFor={`${idPrefix}-height-cm`}>Height (cm)</label>
          <DecimalNumberInput
            id={`${idPrefix}-height-cm`}
            value={dimensions.heightCm}
            onChange={(value) => changeAxis('height', value)}
          />
        </div>
      </div>
      <label>
        <input
          type="checkbox"
          checked={dimensions.lockAspect}
          onChange={(event) => onChange({ lockAspect: event.target.checked })}
        />{' '}
        Lock aspect ratio
      </label>
      {showShapeExplanation && (
        <p className="helper-text shape-size-note">
          Physical size is part of the pattern calculation. It determines how your needle-tip width
          maps onto the model, so changing it may simplify or preserve different details.
        </p>
      )}
    </div>
  );
}
