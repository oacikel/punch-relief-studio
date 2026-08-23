import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReliefControls } from '../ReliefControls';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';

/**
 * Combined-workspace change (docs/ITERATION_03_PLAN.md #13): `ReliefControls`
 * replaces `ReliefStage` (Needle & pile / Punch detail / Shape
 * interpretation groups, no manual "Generate relief" button) and absorbs
 * `HeightStage`'s small-region warning (moved here, under "Punch detail" --
 * see docs/DECISIONS.md).
 *
 * The Workspace two-column redesign removed the former live H1/H2/...
 * pile-height coverage-percentage chip row entirely, per explicit
 * product-owner feedback that it "connects to nothing actionable" for a
 * non-technical user -- see docs/DECISIONS.md. `levels` is no longer a
 * prop `ReliefControls` accepts.
 */
describe('ReliefControls', () => {
  it('renders the Basic controls with their accessible names, and no Generate button', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );

    expect(screen.getByLabelText(/Number of pile heights/)).toBeInTheDocument();
    expect(screen.getByLabelText('Relief depth')).toBeInTheDocument();
    expect(screen.getByLabelText('Smoothing')).toBeInTheDocument();
    expect(screen.getByLabelText('Smallest punchable region')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Raise near surfaces' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate relief/i })).not.toBeInTheDocument();
  });

  it('allows the full widened 2-12 height-level range', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    const slider = screen.getByLabelText(/Number of pile heights/) as HTMLInputElement;
    expect(slider.min).toBe('2');
    expect(slider.max).toBe('12');
  });

  it('keeps Advanced controls collapsed until their disclosure is opened', async () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect(screen.getByLabelText('Height band spacing')).not.toBeVisible();
    await userEvent.click(screen.getByText('Advanced shape controls'));
    expect(screen.getByLabelText('Height band spacing')).toBeVisible();
  });

  it('has no pile-height coverage chip readout anywhere (removed in the Workspace redesign)', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={Int16Array.from([0, 1, 0, 1])}
        width={2}
        height={2}
      />,
    );
    expect(screen.queryByLabelText('Pile height coverage')).not.toBeInTheDocument();
    expect(screen.queryByText(/^H1 /)).not.toBeInTheDocument();
  });

  it('shows the small-region warning under Punch detail when tiny regions exist', () => {
    // A single isolated foreground pixel among a much larger canvas, with
    // an aggressive ('bold') min-region preset, should count as "too
    // small" and produce the warning -- 100x100 at 'bold' (0.08%) rounds
    // to an 8px threshold, safely above the 1px test region.
    const width = 100;
    const height = 100;
    const heightIndex = new Int16Array(width * height).fill(-1);
    heightIndex[0] = 0; // one isolated foreground pixel
    render(
      <ReliefControls
        settings={{ ...DEFAULT_RELIEF_SETTINGS, minRegionPreset: 'bold' }}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={heightIndex}
        width={width}
        height={height}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/smaller than the minimum punchable size/);
  });

  it('renders the needle diameter/throw fields, blank by default', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    const diameter = screen.getByLabelText('Needle diameter (mm)') as HTMLInputElement;
    const throwField = screen.getByLabelText(
      'Needle throw / shaft length (mm)',
    ) as HTMLInputElement;
    expect(diameter.value).toBe('');
    expect(throwField.value).toBe('');
  });

  it('shows the current needle diameter/throw values when set', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 2, throwMm: 40 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect((screen.getByLabelText('Needle diameter (mm)') as HTMLInputElement).value).toBe('2');
    expect(
      (screen.getByLabelText('Needle throw / shaft length (mm)') as HTMLInputElement).value,
    ).toBe('40');
  });

  it('calls onNeedleGeometryChange with only the changed field', async () => {
    const onNeedleGeometryChange = vi.fn();
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={onNeedleGeometryChange}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    await userEvent.type(screen.getByLabelText('Needle diameter (mm)'), '2');
    expect(onNeedleGeometryChange).toHaveBeenLastCalledWith({ diameterMm: 2 });
  });

  it('has no "Detail resolution" control anywhere', () => {
    render(
      <ReliefControls
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect(screen.queryByLabelText('Detail resolution')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced punch detail controls')).not.toBeInTheDocument();
  });
});
