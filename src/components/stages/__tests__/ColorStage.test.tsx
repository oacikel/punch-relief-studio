import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorStage } from '../ColorStage';
import { COLOR_STORY_PALETTES } from '@/domain/color/palettes';
import type { ColorSwatch } from '@/domain/types';

function makeSwatches(count: number): ColorSwatch[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    color: { r: 0, g: 0, b: 0 },
    yarnName: `Yarn ${i + 1}`,
  }));
}

/**
 * Iteration 03 Round 1 (docs/ITERATION_03_PLAN.md #7): a small palette
 * gallery on the Yarn Colors stage, shown only in "by-height" mode.
 */
describe('ColorStage color story palettes', () => {
  it('shows one button per bundled palette when mode is "by-height"', () => {
    render(
      <ColorStage
        mode="by-height"
        swatches={makeSwatches(3)}
        paletteSize={4}
        levelCount={3}
        hasSourceColor={false}
        onModeChange={vi.fn()}
        onSwatchesChange={vi.fn()}
        onPaletteSizeChange={vi.fn()}
        onApplyPalette={vi.fn()}
      />,
    );

    for (const palette of COLOR_STORY_PALETTES) {
      expect(screen.getByRole('button', { name: new RegExp(palette.name) })).toBeInTheDocument();
    }
  });

  it('does not show the palette gallery in "single" mode', () => {
    render(
      <ColorStage
        mode="single"
        swatches={makeSwatches(1)}
        paletteSize={4}
        levelCount={3}
        hasSourceColor={false}
        onModeChange={vi.fn()}
        onSwatchesChange={vi.fn()}
        onPaletteSizeChange={vi.fn()}
        onApplyPalette={vi.fn()}
      />,
    );

    expect(screen.queryByText('Color story palettes')).not.toBeInTheDocument();
  });

  it('calls onApplyPalette with the clicked palette id', async () => {
    const onApplyPalette = vi.fn();
    render(
      <ColorStage
        mode="by-height"
        swatches={makeSwatches(3)}
        paletteSize={4}
        levelCount={3}
        hasSourceColor={false}
        onModeChange={vi.fn()}
        onSwatchesChange={vi.fn()}
        onPaletteSizeChange={vi.fn()}
        onApplyPalette={onApplyPalette}
      />,
    );

    const firstPalette = COLOR_STORY_PALETTES[0];
    if (!firstPalette) throw new Error('expected at least one bundled palette');
    await userEvent.click(screen.getByRole('button', { name: new RegExp(firstPalette.name) }));
    expect(onApplyPalette).toHaveBeenCalledWith(firstPalette.id);
  });
});
