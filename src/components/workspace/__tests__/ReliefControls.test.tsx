import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReliefControls } from '../ReliefControls';
import { DEFAULT_RELIEF_SETTINGS } from '@/domain/types';

const sizeProps = {
  dimensions: { widthCm: 20, heightCm: 20, lockAspect: true },
  onDimensionsChange: vi.fn(),
};

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
        {...sizeProps}
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
        {...sizeProps}
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

  it('edits physical pattern size in Shape because it affects needle-width cleanup', async () => {
    const onDimensionsChange = vi.fn();
    render(
      <ReliefControls
        dimensions={{ widthCm: 20, heightCm: 10, lockAspect: true }}
        onDimensionsChange={onDimensionsChange}
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );

    const widthField = screen.getByLabelText('Width (cm)');
    await userEvent.clear(widthField);
    await userEvent.type(widthField, '30');
    expect(onDimensionsChange).toHaveBeenLastCalledWith({ widthCm: 30, heightCm: 15 });
    expect(screen.getByText(/Physical size is part of the pattern calculation/)).toBeVisible();
  });

  it('keeps Advanced controls collapsed until their disclosure is opened', async () => {
    render(
      <ReliefControls
        {...sizeProps}
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
    await userEvent.click(screen.getByText('Needle & advanced settings'));
    expect(screen.getByLabelText('Height band spacing')).toBeVisible();
  });

  it('has no pile-height coverage chip readout anywhere (removed in the Workspace redesign)', () => {
    render(
      <ReliefControls
        {...sizeProps}
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
        {...sizeProps}
        settings={{ ...DEFAULT_RELIEF_SETTINGS, minRegionPreset: 'bold' }}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={heightIndex}
        width={width}
        height={height}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      /too small to simplify without removing it completely/,
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(/px/);
  });

  it('renders the needle diameter and optional length fields, blank by default', () => {
    render(
      <ReliefControls
        {...sizeProps}
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    const diameter = screen.getByLabelText('Needle tip diameter (mm)') as HTMLInputElement;
    const throwField = screen.getByLabelText(
      'Maximum needle length (mm, optional)',
    ) as HTMLInputElement;
    expect(diameter.value).toBe('');
    expect(throwField.value).toBe('');
  });

  it('shows the current needle diameter and length values when set', () => {
    render(
      <ReliefControls
        {...sizeProps}
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 2, throwMm: 40 }}
        onNeedleGeometryChange={vi.fn()}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    expect((screen.getByLabelText('Needle tip diameter (mm)') as HTMLInputElement).value).toBe('2');
    expect(
      (screen.getByLabelText('Maximum needle length (mm, optional)') as HTMLInputElement).value,
    ).toBe('40');
  });

  it('calls onNeedleGeometryChange with only the changed field', async () => {
    const onNeedleGeometryChange = vi.fn();
    render(
      <ReliefControls
        {...sizeProps}
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={onNeedleGeometryChange}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    await userEvent.type(screen.getByLabelText('Needle tip diameter (mm)'), '2');
    expect(onNeedleGeometryChange).toHaveBeenLastCalledWith({ diameterMm: 2 });
  });

  it('offers common fine-embroidery tip sizes as one-click choices', async () => {
    const onNeedleGeometryChange = vi.fn();
    render(
      <ReliefControls
        {...sizeProps}
        settings={DEFAULT_RELIEF_SETTINGS}
        onChange={vi.fn()}
        needleGeometry={{ diameterMm: 0, throwMm: 0 }}
        onNeedleGeometryChange={onNeedleGeometryChange}
        heightIndex={null}
        width={0}
        height={0}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: '2.2 mm' }));
    expect(onNeedleGeometryChange).toHaveBeenLastCalledWith({ diameterMm: 2.2 });
  });

  it('has no "Detail resolution" control anywhere', () => {
    render(
      <ReliefControls
        {...sizeProps}
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
