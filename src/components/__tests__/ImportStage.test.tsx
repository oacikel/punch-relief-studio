import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportStage, ImportOrientSection } from '../stages/ImportStage';

describe('ImportStage', () => {
  it('lists all three built-in samples', () => {
    render(
      <ImportStage
        onSelectSample={vi.fn()}
        onFilesSelected={vi.fn()}
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
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    await userEvent.click(screen.getByText('Concentric Ripple'));
    expect(onSelectSample).toHaveBeenCalledWith('sample-ripple');
  });

  it('has an accessible file input for the file picker path', () => {
    render(
      <ImportStage
        onSelectSample={vi.fn()}
        onFilesSelected={vi.fn()}
        hasModel={false}
        loadedModelLabel={null}
      />,
    );
    expect(screen.getByLabelText('Choose model files to import')).toBeInTheDocument();
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
          hasModel={true}
          loadedModelLabel="Concentric Ripple"
        />,
      );
      const details = container.querySelector<HTMLDetailsElement>('details.import-picker');
      expect(details?.open).toBe(false);
      expect(screen.getByText(/Model loaded: Concentric Ripple/)).toBeInTheDocument();
    });

    it('lets the user re-expand the collapsed picker and pick a different sample', async () => {
      const onSelectSample = vi.fn();
      const { container } = render(
        <ImportStage
          onSelectSample={onSelectSample}
          onFilesSelected={vi.fn()}
          hasModel={true}
          loadedModelLabel="Concentric Ripple"
        />,
      );
      const details = container.querySelector<HTMLDetailsElement>('details.import-picker');
      expect(details?.open).toBe(false);

      const summary = screen.getByText(/choose a different file/i);
      await userEvent.click(summary);
      expect(details?.open).toBe(true);

      await userEvent.click(screen.getByText('Geometric Steps'));
      expect(onSelectSample).toHaveBeenCalledWith(expect.stringContaining('steps'));
    });
  });
});

// Iteration 02 Stage A: orientation now happens on Import once a model has
// loaded (formerly a separate "Orient" stage) -- see docs/ITERATION_02_PLAN.md.
describe('ImportOrientSection', () => {
  it('shows the single-viewpoint/no-undercuts honesty copy', () => {
    render(<ImportOrientSection onContinue={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Orient the model' })).toBeInTheDocument();
    expect(screen.getByText(/occluded and back surfaces will not appear/i)).toBeInTheDocument();
  });

  it('calls onContinue when the user is done orienting', async () => {
    const onContinue = vi.fn();
    render(<ImportOrientSection onContinue={onContinue} />);
    await userEvent.click(screen.getByRole('button', { name: /Continue to Workspace/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
