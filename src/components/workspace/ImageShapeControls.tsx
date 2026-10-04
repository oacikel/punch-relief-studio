import type { ReliefSettings } from '@/domain/types';
import {
  MIN_REGION_PRESET_DESCRIPTIONS,
  MIN_REGION_PRESET_LABELS,
  MIN_REGION_PRESET_ORDER,
  type MinRegionPreset,
} from '@/domain/pattern/minRegionPreset';
import {
  DEFAULT_DETAIL_SENSITIVITY,
  DEFAULT_DETAIL_STRICTNESS,
  DEFAULT_DETAIL_THICKNESS,
  type ImageDetailSettings,
  type NeedleGeometry,
  type PatternDimensions,
} from '@/state/appState';
import { DecimalNumberInput } from '@/components/DecimalNumberInput';
import { PatternSizeFields } from '@/components/PatternSizeFields';

interface Props {
  settings: ReliefSettings;
  onChange: (patch: Partial<ReliefSettings>) => void;
  needleGeometry: NeedleGeometry;
  onNeedleGeometryChange: (patch: Partial<NeedleGeometry>) => void;
  dimensions: PatternDimensions;
  onDimensionsChange: (patch: Partial<PatternDimensions>) => void;
  imageDetailSettings: ImageDetailSettings;
  onImageDetailSettingsChange: (patch: Partial<ImageDetailSettings>) => void;
  /** EXP-002: the step number shown in this group's own heading -- see
   * `YarnColorsGroup`'s matching prop. Defaults to '1', today's position. */
  stepNumber?: string;
}

export function ImageShapeControls({
  settings,
  onChange,
  needleGeometry,
  onNeedleGeometryChange,
  dimensions,
  onDimensionsChange,
  imageDetailSettings,
  onImageDetailSettingsChange,
  stepNumber = '1',
}: Props): JSX.Element {
  return (
    <div className="control-group rail-section" id="rail-shape">
      <div className="section-intro">
        <span className="section-number">{stepNumber}</span>
        <div>
          <h3>Simplify the image</h3>
        </div>
      </div>

      <div className="shape-size-block">
        <h4>Finished size</h4>
        <PatternSizeFields
          dimensions={dimensions}
          onChange={onDimensionsChange}
          idPrefix="image-shape"
          showShapeExplanation={true}
        />
      </div>

      <div className="field">
        <label htmlFor="image-detail">Image detail</label>
        <select
          id="image-detail"
          value={settings.minRegionPreset}
          onChange={(event) => onChange({ minRegionPreset: event.target.value as MinRegionPreset })}
        >
          {MIN_REGION_PRESET_ORDER.map((preset) => (
            <option key={preset} value={preset}>
              {MIN_REGION_PRESET_LABELS[preset]}
            </option>
          ))}
        </select>
        <p className="helper-text">{MIN_REGION_PRESET_DESCRIPTIONS[settings.minRegionPreset]}</p>
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={imageDetailSettings.preserveSmallDetails}
            onChange={(event) =>
              onImageDetailSettingsChange({ preserveSmallDetails: event.target.checked })
            }
          />{' '}
          Keep tiny symbols and thin lines
        </label>
        <p className="helper-text">
          Slightly enlarges high-contrast details that would otherwise disappear.
        </p>
      </div>

      {imageDetailSettings.preserveSmallDetails && (
        <div className="detail-threshold-fields">
          <div className="field">
            <label htmlFor="image-detail-sensitivity">
              Detail sensitivity (
              {imageDetailSettings.detailSensitivity ?? DEFAULT_DETAIL_SENSITIVITY})
            </label>
            <input
              id="image-detail-sensitivity"
              type="range"
              min={10}
              max={80}
              step={1}
              value={imageDetailSettings.detailSensitivity ?? DEFAULT_DETAIL_SENSITIVITY}
              onChange={(event) =>
                onImageDetailSettingsChange({ detailSensitivity: Number(event.target.value) })
              }
            />
            <p className="helper-text">
              How much a mark must stand out in brightness from its surroundings to be kept.
            </p>
          </div>

          <div className="field">
            <label htmlFor="image-detail-strictness">
              Detail strictness (
              {Math.round(
                (imageDetailSettings.detailStrictness ?? DEFAULT_DETAIL_STRICTNESS) * 100,
              )}
              %)
            </label>
            <input
              id="image-detail-strictness"
              type="range"
              min={0.1}
              max={0.95}
              step={0.05}
              value={imageDetailSettings.detailStrictness ?? DEFAULT_DETAIL_STRICTNESS}
              onChange={(event) =>
                onImageDetailSettingsChange({ detailStrictness: Number(event.target.value) })
              }
            />
            <p className="helper-text">
              How much of a mark's surroundings must contrast strongly for it to be kept.
            </p>
          </div>

          <div className="field">
            <label htmlFor="image-detail-thickness">
              Detail thickness (
              {imageDetailSettings.detailThickness ?? DEFAULT_DETAIL_THICKNESS})
            </label>
            <input
              id="image-detail-thickness"
              type="range"
              min={0}
              max={5}
              step={1}
              value={imageDetailSettings.detailThickness ?? DEFAULT_DETAIL_THICKNESS}
              onChange={(event) =>
                onImageDetailSettingsChange({ detailThickness: Number(event.target.value) })
              }
            />
            <p className="helper-text">
              How much extra width a kept detail gets beyond the usual cleanup radius.
            </p>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="image-smoothing">
          Simplification ({Math.round(settings.smoothingStrength * 100)}%)
        </label>
        <input
          id="image-smoothing"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.smoothingStrength}
          onChange={(event) => onChange({ smoothingStrength: Number(event.target.value) })}
        />
      </div>

      <details className="advanced-controls">
        <summary>Needle &amp; edge settings</summary>
        <div className="field">
          <label htmlFor="image-needle-diameter">Needle tip diameter (mm)</label>
          <DecimalNumberInput
            id="image-needle-diameter"
            value={needleGeometry.diameterMm === 0 ? null : needleGeometry.diameterMm}
            placeholder="Not set"
            onChange={(diameterMm) => onNeedleGeometryChange({ diameterMm: diameterMm ?? 0 })}
          />
          <div className="needle-size-presets" aria-label="Common embroidery needle sizes">
            {[1.3, 1.6, 2.2].map((diameterMm) => (
              <button
                key={diameterMm}
                type="button"
                aria-pressed={needleGeometry.diameterMm === diameterMm}
                onClick={() => onNeedleGeometryChange({ diameterMm })}
              >
                {diameterMm} mm
              </button>
            ))}
          </div>
          <p className="helper-text">
            Zones narrower than this at the finished size are folded into a neighbor.
          </p>
        </div>

        <div className="field">
          <label htmlFor="image-edge">Keep important edges crisp</label>
          <input
            id="image-edge"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.edgePreservation}
            onChange={(event) => onChange({ edgePreservation: Number(event.target.value) })}
          />
          <p className="helper-text">
            Higher values protect strong outlines while smoothing detail inside them.
          </p>
        </div>
      </details>
    </div>
  );
}
