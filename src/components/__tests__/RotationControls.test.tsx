import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RotationControls } from '../RotationControls';
import { ZERO_ROTATION } from '@/state/appState';

/**
 * Combined-workspace change (docs/ITERATION_03_PLAN.md #13): extracted
 * from `Viewport3D.tsx`'s former inline rotation-slider JSX so it can be
 * rendered both on Import (inside `Viewport3D`) and on Workspace's
 * `SimulationPanel`, both bound to the same `AppState.modelRotationDeg`
 * (see docs/DECISIONS.md). `idPrefix` keeps the two instances' `id`/
 * `htmlFor` pairs from colliding.
 */
describe('RotationControls', () => {
  it('renders Roll/Pitch/Yaw sliders reflecting the current value', () => {
    render(
      <RotationControls
        rotationDeg={{ roll: 30, pitch: -15, yaw: 90 }}
        onAxisChange={vi.fn()}
        onReset={vi.fn()}
        idPrefix="import"
      />,
    );
    expect(screen.getByLabelText(/^Roll/)).toHaveValue('30');
    expect(screen.getByLabelText(/^Pitch/)).toHaveValue('-15');
    expect(screen.getByLabelText(/^Yaw/)).toHaveValue('90');
  });

  it('calls onAxisChange with the axis and new value when a slider moves', () => {
    const onAxisChange = vi.fn();
    render(
      <RotationControls
        rotationDeg={ZERO_ROTATION}
        onAxisChange={onAxisChange}
        onReset={vi.fn()}
        idPrefix="import"
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Roll/), { target: { value: '45' } });
    expect(onAxisChange).toHaveBeenCalledWith('roll', 45);
  });

  it('calls onReset when "Reset rotation" is clicked', async () => {
    const onReset = vi.fn();
    render(
      <RotationControls
        rotationDeg={{ roll: 30, pitch: -15, yaw: 90 }}
        onAxisChange={vi.fn()}
        onReset={onReset}
        idPrefix="import"
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reset rotation' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('gives two instances distinct ids via idPrefix, so labels never collide', () => {
    const { container: c1 } = render(
      <RotationControls
        rotationDeg={ZERO_ROTATION}
        onAxisChange={vi.fn()}
        onReset={vi.fn()}
        idPrefix="import"
      />,
    );
    const { container: c2 } = render(
      <RotationControls
        rotationDeg={ZERO_ROTATION}
        onAxisChange={vi.fn()}
        onReset={vi.fn()}
        idPrefix="sim"
      />,
    );
    const id1 = c1.querySelector('input[type="range"]')?.id;
    const id2 = c2.querySelector('input[type="range"]')?.id;
    expect(id1).not.toBe(id2);
  });
});
