/**
 * Parses user-typed numeric text tolerantly of locale decimal separators.
 * `<input type="number">`'s value sanitization algorithm requires a
 * period as the decimal point, per the HTML spec, *regardless of the
 * browser/OS locale* -- a comma-decimal-locale user typing "2,2" gets an
 * input the browser silently treats as invalid, so `input.value` reads
 * back as `""` even though the field still visually shows "2,2". Fed
 * through a bare `Number(...)`, that becomes `0`, not an error -- a
 * needle-diameter field that looks set can silently disable the whole
 * constraint it drives. Every numeric text field in this app should be
 * `type="text" inputMode="decimal"` plus this parser, not `type="number"`.
 *
 * Accepts either "." or "," as the decimal separator (only the first
 * occurrence is treated as one; a second comma/period makes the string
 * unparseable, same as it would be in any locale). Returns `NaN` for
 * anything that still doesn't parse (empty string, stray letters,
 * multiple separators) -- callers decide their own fallback (keep the
 * previous value vs. treat as 0/null are both legitimate depending on
 * context), this function never guesses one for them.
 */
export function parseLocaleNumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed === '') return NaN;
  return Number(trimmed.replace(',', '.'));
}
