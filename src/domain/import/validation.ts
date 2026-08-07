/**
 * Pre-parse validation and size/complexity limits for imported models.
 * Pure functions over a File's metadata + a byte sample -- runs before the
 * expensive parse so bad input fails fast with a useful message instead of
 * hanging the browser.
 */

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
export const WARN_FILE_SIZE_BYTES = 30 * 1024 * 1024; // warn above this
export const MAX_TRIANGLES = 2_000_000;
export const WARN_TRIANGLES = 500_000;

export type SupportedExtension = 'stl' | 'obj' | 'mtl';

export class UnsupportedFormatError extends Error {
  constructor(filename: string) {
    super(
      `"${filename}" isn't a supported format. Punch Relief Studio reads binary/ASCII STL and ` +
        'OBJ (optionally with a matching MTL and local texture images).',
    );
    this.name = 'UnsupportedFormatError';
  }
}

export class FileTooLargeError extends Error {
  constructor(filename: string, sizeBytes: number) {
    super(
      `"${filename}" is ${(sizeBytes / 1024 / 1024).toFixed(1)}MB, above the ${
        MAX_FILE_SIZE_BYTES / 1024 / 1024
      }MB limit. Try a simplified or lower-resolution export of the model.`,
    );
    this.name = 'FileTooLargeError';
  }
}

export class EmptyFileError extends Error {
  constructor(filename: string) {
    super(`"${filename}" is empty.`);
    this.name = 'EmptyFileError';
  }
}

export function detectExtension(filename: string): SupportedExtension | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  const ext = match?.[1]?.toLowerCase();
  if (ext === 'stl' || ext === 'obj' || ext === 'mtl') return ext;
  return null;
}

export function validateFile(file: File): void {
  if (file.size === 0) throw new EmptyFileError(file.name);
  if (file.size > MAX_FILE_SIZE_BYTES) throw new FileTooLargeError(file.name, file.size);
  const ext = detectExtension(file.name);
  if (ext === null) throw new UnsupportedFormatError(file.name);
}

export interface ComplexityWarning {
  triangleCount: number;
  level: 'ok' | 'warn' | 'block';
  message: string | null;
}

export function assessComplexity(triangleCount: number): ComplexityWarning {
  if (triangleCount > MAX_TRIANGLES) {
    return {
      triangleCount,
      level: 'block',
      message:
        `This model has ${triangleCount.toLocaleString()} triangles, above the ` +
        `${MAX_TRIANGLES.toLocaleString()} limit this app can process interactively. Simplify the ` +
        `mesh (e.g. with a decimate tool) and re-import.`,
    };
  }
  if (triangleCount > WARN_TRIANGLES) {
    return {
      triangleCount,
      level: 'warn',
      message:
        `This model has ${triangleCount.toLocaleString()} triangles. Processing may be slow on ` +
        'this device -- consider a simplified export if the viewport feels sluggish.',
    };
  }
  return { triangleCount, level: 'ok', message: null };
}
