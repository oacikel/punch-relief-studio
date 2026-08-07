import { describe, expect, it } from 'vitest';
import {
  EmptyFileError,
  FileTooLargeError,
  MAX_FILE_SIZE_BYTES,
  MAX_TRIANGLES,
  UnsupportedFormatError,
  WARN_TRIANGLES,
  assessComplexity,
  detectExtension,
  validateFile,
} from '../validation';

function makeFile(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe('detectExtension', () => {
  it('recognizes stl, obj, mtl case-insensitively', () => {
    expect(detectExtension('model.STL')).toBe('stl');
    expect(detectExtension('model.obj')).toBe('obj');
    expect(detectExtension('materials.Mtl')).toBe('mtl');
  });

  it('returns null for unsupported extensions', () => {
    expect(detectExtension('model.fbx')).toBeNull();
    expect(detectExtension('noextension')).toBeNull();
  });
});

describe('validateFile', () => {
  it('rejects an empty file', () => {
    expect(() => validateFile(makeFile('a.stl', 0))).toThrow(EmptyFileError);
  });

  it('rejects a file over the size limit', () => {
    expect(() => validateFile(makeFile('a.stl', MAX_FILE_SIZE_BYTES + 1))).toThrow(
      FileTooLargeError,
    );
  });

  it('rejects an unsupported format', () => {
    expect(() => validateFile(makeFile('a.fbx', 100))).toThrow(UnsupportedFormatError);
  });

  it('accepts a small, well-formed stl filename', () => {
    expect(() => validateFile(makeFile('a.stl', 100))).not.toThrow();
  });
});

describe('assessComplexity', () => {
  it('is "ok" below the warning threshold', () => {
    expect(assessComplexity(1000).level).toBe('ok');
  });

  it('is "warn" between warn and block thresholds', () => {
    expect(assessComplexity(WARN_TRIANGLES + 1).level).toBe('warn');
  });

  it('is "block" above the hard triangle limit', () => {
    expect(assessComplexity(MAX_TRIANGLES + 1).level).toBe('block');
  });
});
