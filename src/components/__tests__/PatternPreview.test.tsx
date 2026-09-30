import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatternPreview } from '../PatternPreview';

/**
 * EXP-007 ("ship fit-to-screen default plus pan and zoom as a standalone
 * release"). Only the DOM-observable pieces are covered here -- rendering,
 * the "Fit to screen" control's enabled/disabled state, and wheel-driven
 * zoom (jsdom implements `WheelEvent` natively). Pointer-driven pan/pinch
 * is e2e-only (jsdom has no `PointerEvent`); the underlying arithmetic for
 * all three is covered directly in `patternPreviewGestures.test.ts`.
 */
describe('PatternPreview', () => {
  it('renders the pattern image with its alt text and a zoom readout', () => {
    render(<PatternPreview src="blob:mock-1" alt="Punch-needle pattern, color-only view" />);
    expect(screen.getByAltText('Punch-needle pattern, color-only view')).toBeInTheDocument();
    expect(screen.getByText('100% zoom')).toBeInTheDocument();
  });

  it('renders nothing for the image when src is null, without crashing', () => {
    render(<PatternPreview src={null} alt="Punch-needle pattern" />);
    expect(screen.queryByAltText('Punch-needle pattern')).not.toBeInTheDocument();
    expect(screen.getByText('100% zoom')).toBeInTheDocument();
  });

  it('starts with "Fit to screen" disabled -- already at the fit default', () => {
    render(<PatternPreview src="blob:mock-1" alt="Punch-needle pattern" />);
    expect(screen.getByRole('button', { name: 'Fit to screen' })).toBeDisabled();
  });

  it('scrolling up (negative deltaY) zooms in, enabling "Fit to screen"', () => {
    render(<PatternPreview src="blob:mock-1" alt="Punch-needle pattern" />);
    const viewport = screen.getByAltText('Punch-needle pattern').parentElement;
    expect(viewport).not.toBeNull();

    fireEvent.wheel(viewport as Element, { deltaY: -500 });

    expect(screen.getByRole('button', { name: 'Fit to screen' })).toBeEnabled();
    const readout = screen.getByText(/% zoom$/);
    expect(readout.textContent).not.toBe('100% zoom');
  });

  it('"Fit to screen" resets zoom back to 100% and disables itself again', async () => {
    const user = userEvent.setup();
    render(<PatternPreview src="blob:mock-1" alt="Punch-needle pattern" />);
    const viewport = screen.getByAltText('Punch-needle pattern').parentElement as Element;

    fireEvent.wheel(viewport, { deltaY: -500 });
    const fitButton = screen.getByRole('button', { name: 'Fit to screen' });
    expect(fitButton).toBeEnabled();

    await user.click(fitButton);

    expect(screen.getByText('100% zoom')).toBeInTheDocument();
    expect(fitButton).toBeDisabled();
  });

  it('resets to fit when the pattern src changes', () => {
    const { rerender } = render(<PatternPreview src="blob:mock-1" alt="Punch-needle pattern" />);
    const viewport = screen.getByAltText('Punch-needle pattern').parentElement as Element;
    fireEvent.wheel(viewport, { deltaY: -500 });
    expect(screen.getByRole('button', { name: 'Fit to screen' })).toBeEnabled();

    rerender(<PatternPreview src="blob:mock-2" alt="Punch-needle pattern" />);

    expect(screen.getByText('100% zoom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fit to screen' })).toBeDisabled();
  });
});
