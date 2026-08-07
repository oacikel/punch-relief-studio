import type { LegendEntry } from '@/domain/pattern/legend';

interface Props {
  entries: LegendEntry[];
  calibrated: boolean;
}

/**
 * The single legend table shared by the on-screen pattern, the PDF export,
 * and the simulation comparison -- see CLAUDE.md: never let these disagree.
 * Every row shows a symbol + ID in addition to the color swatch so the
 * pattern stays readable without relying on color alone.
 */
export function Legend({ entries, calibrated }: Props): JSX.Element {
  return (
    <div>
      {!calibrated && (
        <p className="helper-text" role="status">
          Needle settings below are from an uncalibrated profile -- they show relative low-to-high
          order only, not measured heights. See the Calibration step to measure real values.
        </p>
      )}
      <table className="legend-table">
        <caption className="helper-text">Region legend: color, height, and needle setting</caption>
        <thead>
          <tr>
            <th scope="col">Region</th>
            <th scope="col">Symbol</th>
            <th scope="col">Yarn color</th>
            <th scope="col">Yarn name</th>
            <th scope="col">Needle setting</th>
            <th scope="col">Measured height</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <th scope="row">{entry.id}</th>
              <td>{entry.symbol}</td>
              <td>
                <span className="swatch" style={{ background: entry.color }} aria-hidden="true" />
                {entry.color}
              </td>
              <td>{entry.yarnName}</td>
              <td>
                {entry.needleSettingNumber}: {entry.needleSettingLabel}
              </td>
              <td>
                {entry.measuredHeightCm !== null
                  ? `${entry.measuredHeightCm.toFixed(2)} cm`
                  : 'uncalibrated'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
