import type { LegendEntry } from '@/domain/pattern/legend';

interface Props {
  entries: LegendEntry[];
}

/**
 * The single legend table shared by the on-screen pattern, the PDF export,
 * and the simulation comparison -- see CLAUDE.md: never let these disagree.
 * Every row shows a symbol + ID in addition to the color swatch so the
 * pattern stays readable without relying on color alone.
 *
 * As of Iteration 03 Round 1, needle-setting/measured-height columns are
 * removed (calibration UI was removed app-wide by explicit, reversible
 * product decision -- see docs/ITERATION_03_PLAN.md #6 and
 * docs/DECISIONS.md). The Symbol column stays: it's the region-identity
 * requirement from CLAUDE.md's "never rely on color alone" rule, which is
 * unrelated to calibration.
 */
export function Legend({ entries }: Props): JSX.Element {
  return (
    <div className="legend-table-wrap">
      <table className="legend-table">
        <caption className="helper-text">Region legend: color and symbol</caption>
        <thead>
          <tr>
            <th scope="col">Region</th>
            <th scope="col">Symbol</th>
            <th scope="col">Yarn color</th>
            <th scope="col">Yarn name</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
