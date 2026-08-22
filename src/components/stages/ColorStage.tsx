import type { ColorMode, ColorSwatch, RgbColor } from '@/domain/types';
import { COLOR_STORY_PALETTES } from '@/domain/color/palettes';

interface Props {
  mode: ColorMode;
  swatches: ColorSwatch[];
  paletteSize: number;
  levelCount: number;
  hasSourceColor: boolean;
  onModeChange: (mode: ColorMode) => void;
  onSwatchesChange: (swatches: ColorSwatch[]) => void;
  onPaletteSizeChange: (size: number) => void;
  /** Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #7): applies a named
   * color-story palette's colors to the current swatches in one click.
   * Only meaningful in "by-height" mode -- see the gallery below. */
  onApplyPalette: (paletteId: string) => void;
}

function toHex(c: RgbColor): string {
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}
function fromHex(hex: string): RgbColor {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Color stage: single / by-height / source-material modes per product
 * spec §10, with swatch editing and yarn naming. */
export function ColorStage({
  mode,
  swatches,
  paletteSize,
  levelCount,
  hasSourceColor,
  onModeChange,
  onSwatchesChange,
  onPaletteSizeChange,
  onApplyPalette,
}: Props): JSX.Element {
  return (
    <section className="stage-panel" aria-labelledby="color-heading">
      <h2 id="color-heading">Yarn colors</h2>

      <fieldset className="field">
        <legend>Color mode</legend>
        <label>
          <input
            type="radio"
            name="color-mode"
            checked={mode === 'single'}
            onChange={() => onModeChange('single')}
          />{' '}
          Single yarn -- whole pattern is one color
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="color-mode"
            checked={mode === 'by-height'}
            onChange={() => onModeChange('by-height')}
          />{' '}
          Color by height -- each level gets its own color
        </label>
        <br />
        <label>
          <input
            type="radio"
            name="color-mode"
            checked={mode === 'source-material'}
            disabled={!hasSourceColor}
            onChange={() => onModeChange('source-material')}
          />{' '}
          Source-material color
          {!hasSourceColor && ' (unavailable -- this import has no color/material data)'}
        </label>
      </fieldset>

      {mode === 'source-material' && (
        <div className="field">
          <label htmlFor="palette-size">Palette size ({paletteSize} colors)</label>
          <input
            id="palette-size"
            type="range"
            min={2}
            max={12}
            value={paletteSize}
            onChange={(e) => onPaletteSizeChange(Number(e.target.value))}
          />
        </div>
      )}

      {mode === 'by-height' && (
        <div className="control-group">
          <h3>Color story palettes</h3>
          <p className="helper-text">
            Apply a hand-picked color collection to all the swatches below in one click. You can
            still edit any swatch by hand afterward.
          </p>
          <div
            role="group"
            aria-label="Color story palettes"
            style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            {COLOR_STORY_PALETTES.map((palette) => (
              <button
                key={palette.id}
                type="button"
                onClick={() => onApplyPalette(palette.id)}
                title={palette.description}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                }}
              >
                <span style={{ display: 'flex' }}>
                  {palette.colors.map((c, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 16,
                        height: 16,
                        background: `rgb(${c.r}, ${c.g}, ${c.b})`,
                      }}
                    />
                  ))}
                </span>
                <strong>{palette.name}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      <h3>Swatches</h3>
      <table className="legend-table">
        <thead>
          <tr>
            <th scope="col">Swatch</th>
            <th scope="col">Color</th>
            <th scope="col">Yarn name</th>
          </tr>
        </thead>
        <tbody>
          {swatches.map((s, i) => (
            <tr key={s.index}>
              <th scope="row">C{s.index + 1}</th>
              <td>
                <label className="visually-hidden" htmlFor={`swatch-color-${s.index}`}>
                  Color for swatch {s.index + 1}
                </label>
                <input
                  id={`swatch-color-${s.index}`}
                  type="color"
                  value={toHex(s.color)}
                  onChange={(e) => {
                    const next = [...swatches];
                    next[i] = { ...s, color: fromHex(e.target.value) };
                    onSwatchesChange(next);
                  }}
                />
              </td>
              <td>
                <label className="visually-hidden" htmlFor={`swatch-name-${s.index}`}>
                  Yarn name for swatch {s.index + 1}
                </label>
                <input
                  id={`swatch-name-${s.index}`}
                  value={s.yarnName}
                  onChange={(e) => {
                    const next = [...swatches];
                    next[i] = { ...s, yarnName: e.target.value };
                    onSwatchesChange(next);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {mode === 'by-height' && swatches.length !== levelCount && (
        <p className="helper-text">
          Generate the relief first so there is one swatch per height level ({levelCount} needed).
        </p>
      )}
    </section>
  );
}
