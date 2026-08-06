import { describe, expect, it } from 'vitest';
import { sanitizeFilename, withExtension } from '../filenameSanitize';

describe('sanitizeFilename', () => {
  it('replaces path separators and reserved characters', () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).not.toMatch(/[/\\:*?"<>|]/);
  });

  it('collapses whitespace to single hyphens', () => {
    expect(sanitizeFilename('My   Pattern   Name')).toBe('My-Pattern-Name');
  });

  it('falls back to a default for an empty/degenerate result', () => {
    expect(sanitizeFilename('   ')).toBe('punch-relief-pattern');
    expect(sanitizeFilename('///')).toBe('punch-relief-pattern');
  });

  it('caps length at 120 characters', () => {
    const long = 'a'.repeat(500);
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(120);
  });
});

describe('withExtension', () => {
  it('appends a clean extension without a leading dot', () => {
    expect(withExtension('My Pattern', '.svg')).toBe('My-Pattern.svg');
    expect(withExtension('My Pattern', 'png')).toBe('My-Pattern.png');
  });
});
