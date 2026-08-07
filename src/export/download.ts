/**
 * Trigger a browser download for a Blob/string, with a sanitized filename.
 * Centralized so export failures (denied by browser, etc.) are handled and
 * reported once instead of duplicated per export type.
 */
import { sanitizeFilename } from '@/domain/filenameSanitize';

export class ExportFailedError extends Error {
  constructor(cause: unknown) {
    super(
      'Export failed. Your browser may have blocked the download -- check your download settings.',
    );
    this.name = 'ExportFailedError';
    this.cause = cause;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  try {
    const safeName = sanitizeFilename(filename, 'punch-relief-export');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName.includes('.') ? safeName : `${safeName}.dat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    throw new ExportFailedError(err);
  }
}

export function downloadText(text: string, filename: string, mimeType: string): void {
  downloadBlob(new Blob([text], { type: mimeType }), filename);
}

export function downloadSvg(svg: string, filename: string): void {
  downloadText(svg, filename, 'image/svg+xml');
}

export function downloadJson(obj: unknown, filename: string): void {
  downloadText(JSON.stringify(obj, null, 2), filename, 'application/json');
}

/** Rasterize an SVG string to a PNG Blob via an offscreen canvas. */
export async function svgToPngBlob(svg: string, widthPx: number, heightPx: number): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
        'image/png',
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to rasterize SVG for PNG export'));
    img.src = src;
  });
}
