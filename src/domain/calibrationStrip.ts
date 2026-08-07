/**
 * Generate a printable calibration-strip SVG: one labeled block per needle
 * setting plus a ruler guide, so a user can physically punch each setting
 * on scrap fabric and measure the real pile height before trusting a
 * profile's numbers.
 */
import type { CalibrationProfile } from './calibration';

export interface CalibrationStripSvg {
  svg: string;
  widthCm: number;
  heightCm: number;
  blockCount: number;
}

const BLOCK_WIDTH_CM = 4;
const BLOCK_HEIGHT_CM = 6;
const MARGIN_CM = 1;
const PX_PER_CM = 37.8; // ~96dpi

export function generateCalibrationStrip(profile: CalibrationProfile): CalibrationStripSvg {
  const settings = [...profile.settings].sort((a, b) => a.settingNumber - b.settingNumber);
  const widthCm = MARGIN_CM * 2 + settings.length * BLOCK_WIDTH_CM;
  const heightCm = MARGIN_CM * 2 + BLOCK_HEIGHT_CM + 2; // + label/ruler space
  const widthPx = widthCm * PX_PER_CM;
  const heightPx = heightCm * PX_PER_CM;

  const blocks = settings
    .map((s, i) => {
      const x = (MARGIN_CM + i * BLOCK_WIDTH_CM) * PX_PER_CM;
      const y = MARGIN_CM * PX_PER_CM;
      const w = BLOCK_WIDTH_CM * PX_PER_CM;
      const h = BLOCK_HEIGHT_CM * PX_PER_CM;
      const measured =
        s.measuredHeightCm !== null
          ? `${s.measuredHeightCm.toFixed(2)} cm measured`
          : 'not yet measured';
      return `
        <g>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#333" stroke-width="1.5" />
          <text x="${x + w / 2}" y="${y + h + 18}" font-size="12" text-anchor="middle">Setting ${s.settingNumber}</text>
          <text x="${x + w / 2}" y="${y + h + 34}" font-size="10" text-anchor="middle" fill="#555">${s.label}</text>
          <text x="${x + w / 2}" y="${y + h + 48}" font-size="9" text-anchor="middle" fill="#888">${measured}</text>
        </g>`;
    })
    .join('\n');

  const rulerY = MARGIN_CM * PX_PER_CM;
  const rulerTicks = Array.from({ length: 21 }, (_, mm) => {
    const y = rulerY + (mm / 10) * PX_PER_CM;
    const isCm = mm % 10 === 0;
    return `<line x1="${widthPx - 24}" y1="${y}" x2="${widthPx - (isCm ? 8 : 16)}" y2="${y}" stroke="#333" stroke-width="${isCm ? 1.5 : 0.75}" />`;
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
    <rect width="${widthPx}" height="${heightPx}" fill="#ffffff" />
    <text x="${MARGIN_CM * PX_PER_CM}" y="16" font-size="13" font-weight="bold">Calibration strip -- ${escapeXml(profile.profileName)}</text>
    ${blocks}
    <g>${rulerTicks}</g>
    <text x="${widthPx - 24}" y="${rulerY + BLOCK_HEIGHT_CM * PX_PER_CM + 60}" font-size="9" text-anchor="end" fill="#888">2cm ruler</text>
  </svg>`;

  return { svg, widthCm, heightCm, blockCount: settings.length };
}

function escapeXml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] ?? c,
  );
}
