import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportStage, ImportOrientSection } from '../stages/ImportStage';
import { PATTERN_RECIPES } from '@/domain/pattern/recipes';

describe('ImportStage', () => {
  it('lists all built-in 3D samples below the shared importer', () => {
    render(
      <ImportStage
        onSelectSample={vi.fn()}
        onFilesSelected={vi.fn()}
        onImageSelected={vi.fn()}
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    expect(screen.getByText('Concentric Ripple')).toBeInTheDocument();
    expect(screen.getByText('Rounded Relief (Eye)')).toBeInTheDocument();
    expect(screen.getByText('Geometric Steps')).toBeInTheDocument();
  });

  it('calls onSelectSample with the right id when a sample button is clicked', async () => {
    const onSelectSample = vi.fn();
    render(
      <ImportStage
        onSelectSample={onSelectSample}
        onFilesSelected={vi.fn()}
        onImageSelected={vi.fn()}
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    await userEvent.click(screen.getByText('Concentric Ripple'));
    expect(onSelectSample).toHaveBeenCalledWith('sample-ripple');
  });

  it('uses one accessible picker for 2D images and 3D models', () => {
    render(
      <ImportStage
        onSelectSample={vi.fn()}
        onFilesSelected={vi.fn()}
        onImageSelected={vi.fn()}
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    const picker = screen.getByLabelText('Choose a 2D image or 3D model to import');
    expect(picker).toHaveAttribute('accept', expect.stringContaining('.png'));
    expect(picker).toHaveAttribute('accept', expect.stringContaining('.obj'));
  });

  // Usability fix (docs/DECISIONS.md, follow-up to "move the Import 3D
  // orient viewport above the fold"): the sample-picker/drop-zone used to
  // stay fully rendered at ~700px tall even after a model had loaded, which
  // is what actually pushed the viewport and "Continue to Workspace" button
  // below the fold. It now collapses into a <details> disclosure once
  // hasModel is true.
  describe('collapsing the picker once a model is loaded', () => {
    it('is open by default before any model has loaded', () => {
      const { container } = render(
        <ImportStage
          onSelectSample={vi.fn()}
          onFilesSelected={vi.fn()}
          onImageSelected={vi.fn()}
          hasModel={false}
          loadedModelLabel={null}
        />,
      );
      const details = container.querySelector<HTMLDetailsElement>('details.import-picker');
      expect(details).not.toBeNull();
      expect(details?.open).toBe(true);
    });

    it('collapses (closed by default) once hasModel is true, and shows a summary of what loaded', () => {
      const { container } = render(
        <ImportStage
          onSelectSample={vi.fn()}
          onFilesSelected={vi.fn()}
          onImageSelected={vi.fn()}
          hasModel={true}
          loadedModelLabel="Concentric Ripple"
        />,
      );
      const details = container.querySelector<HTMLDetailsElement>('details.import-picker');
      expect(details?.open).toBe(false);
      expect(screen.getByText(/Source: Concentric Ripple · Change/)).toBeInTheDocument();
    });

    it('lets the user re-expand the collapsed picker and pick a different sample', async () => {
      const onSelectSample = vi.fn();
      const { container } = render(
        <ImportStage
          onSelectSample={onSelectSample}
          onFilesSelected={vi.fn()}
          onImageSelected={vi.fn()}
          hasModel={true}
          loadedModelLabel="Concentric Ripple"
        />,
      );
      const details = container.querySelector<HTMLDetailsElement>('details.import-picker');
      expect(details?.open).toBe(false);

      const summary = screen.getByText(/Source: Concentric Ripple · Change/i);
      await userEvent.click(summary);
      expect(details?.open).toBe(true);

      await userEvent.click(screen.getByText('Geometric Steps'));
      expect(onSelectSample).toHaveBeenCalledWith(expect.stringContaining('steps'));
    });
  });

  it('routes an image selected through the shared picker to image import', async () => {
    const onImageSelected = vi.fn();
    render(
      <ImportStage
        onSelectSample={vi.fn()}
        onFilesSelected={vi.fn()}
        onImageSelected={onImageSelected}
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    const image = new File(['image'], 'art.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose a 2D image or 3D model to import'), image);
    expect(onImageSelected).toHaveBeenCalledWith(image);
  });

  it('routes OBJ companion files together through the shared picker', async () => {
    const onFilesSelected = vi.fn();
    render(
      <ImportStage
        onSelectSample={vi.fn()}
        onFilesSelected={onFilesSelected}
        onImageSelected={vi.fn()}
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    const obj = new File(['v 0 0 0'], 'shape.obj', { type: 'text/plain' });
    const texture = new File(['image'], 'texture.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('Choose a 2D image or 3D model to import'), [
      obj,
      texture,
    ]);
    expect(onFilesSelected).toHaveBeenCalledWith([obj, texture]);
  });
});

// Iteration 02 Stage A: orientation now happens on Import once a model has
// loaded (formerly a separate "Orient" stage) -- see docs/ITERATION_02_PLAN.md.
describe('ImportOrientSection', () => {
  it('shows the single-viewpoint/no-undercuts honesty copy', () => {
    render(<ImportOrientSection onContinue={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Is this the view you want?' })).toBeInTheDocument();
    expect(screen.getByText(/single-viewpoint relief rather than a full 3D/i)).toBeInTheDocument();
  });

  it('calls onContinue when the user is done orienting', async () => {
    const onContinue = vi.fn();
    render(<ImportOrientSection onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /Create my pattern/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // EXP-003: the notice is opt-in per render site, so the control variant
  // (and every existing caller) keeps exactly the copy it has today.
  it('shows no EXP-003 notice by default', () => {
    render(<ImportOrientSection onContinue={vi.fn()} />);
    expect(screen.queryByRole('region', { name: 'What your pattern will show' })).toBeNull();
  });

  it('replaces the one-line honesty copy with the EXP-003 notice when asked, rather than stacking both', async () => {
    const onContinue = vi.fn();
    render(<ImportOrientSection onContinue={onContinue} showPreviewExpectations />);

    expect(screen.getByRole('region', { name: 'What your pattern will show' })).toBeInTheDocument();
    expect(screen.queryByText(/single-viewpoint relief rather than a full 3D/i)).toBeNull();

    // Still the same step, with the same forward action -- the notice is
    // copy, never a gate in front of "Create my pattern".
    await userEvent.click(screen.getByRole('button', { name: /Create my pattern/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  // EXP-012 ("One-click pattern recipes"): named recipe cards are opt-in per
  // render site, same as EXP-003's notice above -- every existing caller
  // that doesn't pass `recipes` keeps today's plain continue button.
  it('shows no recipe cards by default', () => {
    render(<ImportOrientSection onContinue={vi.fn()} />);
    expect(screen.queryByText('Start from a recipe')).toBeNull();
  });

  it('shows all five named recipe cards when recipes are supplied', () => {
    render(
      <ImportOrientSection
        onContinue={vi.fn()}
        recipes={PATTERN_RECIPES}
        onApplyRecipe={vi.fn()}
      />,
    );
    for (const recipe of PATTERN_RECIPES) {
      expect(screen.getByRole('button', { name: new RegExp(recipe.name) })).toBeInTheDocument();
    }
  });

  it('calls onApplyRecipe with the clicked recipe, not onContinue', async () => {
    const onApplyRecipe = vi.fn();
    const onContinue = vi.fn();
    render(
      <ImportOrientSection
        onContinue={onContinue}
        recipes={PATTERN_RECIPES}
        onApplyRecipe={onApplyRecipe}
      />,
    );
    const firstRecipe = PATTERN_RECIPES[0]!;
    await userEvent.click(screen.getByRole('button', { name: new RegExp(firstRecipe.name) }));
    expect(onApplyRecipe).toHaveBeenCalledWith(firstRecipe);
    expect(onContinue).not.toHaveBeenCalled();
  });
});
