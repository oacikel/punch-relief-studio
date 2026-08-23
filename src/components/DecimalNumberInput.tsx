/**
 * A locale-tolerant replacement for `<input type="number">` (see
 * `src/domain/numberInput.ts` for why `type="number"` is unsafe for any
 * comma-decimal locale). `type="text" inputMode="decimal"` accepts any
 * character the user types -- the browser never silently rejects a comma
 * the way `type="number"` does -- so this component owns a local text
 * buffer and only commits upward (`onChange`) once the typed text
 * actually parses. Without that buffer, a fully-controlled `value={n}`
 * input would fight the user: React re-renders with the last *committed*
 * value on every keystroke, which would wipe an in-progress "2," back to
 * "2" (or to the placeholder) before they can type the second digit.
 *
 * `value`/`onChange` are `number | null` -- `null` is "empty" (blank
 * field), never overloaded onto `0`, since `0` is sometimes a real,
 * distinct measured value (e.g. a calibration setting's measured height).
 *
 * Re-syncs the local text from `value` only when `value` changed for a
 * reason *other* than this component's own last commit (checked by
 * reparsing the current text and comparing) -- so an external change
 * (e.g. loading a saved project) updates the field, but the field doesn't
 * fight the user's own in-progress typing on every valid keystroke.
 */
import { useEffect, useState } from 'react';
import { parseLocaleNumber } from '@/domain/numberInput';

interface Props {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}

function formatValue(value: number | null): string {
  return value === null ? '' : String(value);
}

export function DecimalNumberInput({ id, value, onChange, placeholder }: Props): JSX.Element {
  const [text, setText] = useState(() => formatValue(value));

  useEffect(() => {
    const parsed = text.trim() === '' ? null : parseLocaleNumber(text);
    if (parsed === null ? value !== null : Number.isNaN(parsed) || parsed !== value) {
      setText(formatValue(value));
    }
    // Deliberately omits `text` -- this effect exists only to resync from
    // an *external* value change, reading the latest `text` at that
    // moment via closure; including it would refire on every local
    // keystroke this same effect is designed not to disturb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') {
          onChange(null);
          return;
        }
        const parsed = parseLocaleNumber(raw);
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
    />
  );
}
