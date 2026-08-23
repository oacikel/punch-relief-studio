import { describe, expect, it } from 'vitest';
import { parseLocaleNumber } from '../numberInput';

describe('parseLocaleNumber', () => {
  it('parses a plain period-decimal number', () => {
    expect(parseLocaleNumber('2.2')).toBeCloseTo(2.2);
  });

  it('parses a comma-decimal number the same way', () => {
    expect(parseLocaleNumber('2,2')).toBeCloseTo(2.2);
  });

  it('parses a plain integer', () => {
    expect(parseLocaleNumber('40')).toBe(40);
  });

  it('returns NaN for an empty string, not 0', () => {
    expect(Number.isNaN(parseLocaleNumber(''))).toBe(true);
  });

  it('returns NaN for whitespace-only input', () => {
    expect(Number.isNaN(parseLocaleNumber('   '))).toBe(true);
  });

  it('returns NaN for unparseable text', () => {
    expect(Number.isNaN(parseLocaleNumber('abc'))).toBe(true);
  });

  it('returns NaN for a second decimal separator, same as any locale would reject it', () => {
    expect(Number.isNaN(parseLocaleNumber('2,2,3'))).toBe(true);
    expect(Number.isNaN(parseLocaleNumber('2.2.3'))).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseLocaleNumber('  2,2  ')).toBeCloseTo(2.2);
  });

  it('parses a negative number with either separator', () => {
    expect(parseLocaleNumber('-1.5')).toBeCloseTo(-1.5);
    expect(parseLocaleNumber('-1,5')).toBeCloseTo(-1.5);
  });
});
