import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DecimalNumberInput } from '../DecimalNumberInput';

describe('DecimalNumberInput', () => {
  it('renders a set value as text', () => {
    render(<DecimalNumberInput id="x" value={2.2} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('2.2');
  });

  it('renders null as a blank field', () => {
    render(<DecimalNumberInput id="x" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('is a real text input, not a number input -- a comma is never blocked at the keystroke level', () => {
    render(<DecimalNumberInput id="x" value={null} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
  });

  it('commits a comma-decimal value as the correctly parsed number', async () => {
    const onChange = vi.fn();
    render(<DecimalNumberInput id="x" value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '2,2');
    expect(onChange).toHaveBeenLastCalledWith(2.2);
  });

  it('commits a plain period-decimal value the same way', async () => {
    const onChange = vi.fn();
    render(<DecimalNumberInput id="x" value={null} onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), '2.2');
    expect(onChange).toHaveBeenLastCalledWith(2.2);
  });

  it('does not call onChange for an unparseable intermediate value, but keeps the typed text visible', async () => {
    const onChange = vi.fn();
    render(<DecimalNumberInput id="x" value={null} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '-');
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('-');
  });

  it('calls onChange with null when the field is cleared back to empty', async () => {
    const onChange = vi.fn();
    render(<DecimalNumberInput id="x" value={5} onChange={onChange} />);
    await userEvent.clear(screen.getByRole('textbox'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('updates the displayed text when value changes externally (e.g. a loaded project)', () => {
    const { rerender } = render(<DecimalNumberInput id="x" value={2.2} onChange={vi.fn()} />);
    rerender(<DecimalNumberInput id="x" value={5} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox')).toHaveValue('5');
  });

  it('does not fight the user mid-typing a value that round-trips back through a real onChange handler', async () => {
    function Wrapper(): JSX.Element {
      const [value, setValue] = useState<number | null>(null);
      return <DecimalNumberInput id="x" value={value} onChange={setValue} />;
    }
    render(<Wrapper />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '2,2');
    // Each valid keystroke (e.g. "2" then "2,2") commits upward and the
    // committed value flows back down as a new `value` prop -- the field
    // must still show what the user actually typed, not a reformatted
    // snap-back, since the re-sync effect skips when the prop matches
    // what the current text already parses to.
    expect(input).toHaveValue('2,2');
  });
});
