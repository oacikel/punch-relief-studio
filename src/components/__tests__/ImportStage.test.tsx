import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportStage, ImportOrientSection } from '../stages/ImportStage';
import { TWO_D_STARTERS } from '@/image/starterImages';

function stubCanvasDrawing(): void {
  const fakeContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void,
  ) {
    callback(new Blob(['fake-png-bytes'], { type: 'image/png' }));
  });
}

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

  describe('2D starters', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('lists at least three license-clean 2D starters in their own labelled group', () => {
      render(
        <ImportStage
          onSelectSample={vi.fn()}
          onFilesSelected={vi.fn()}
          onImageSelected={vi.fn()}
          hasModel={false}
          loadedModelLabel={null}
        />,
      );
      expect(screen.getByText('2D starters')).toBeInTheDocument();
      expect(TWO_D_STARTERS.length).toBeGreaterThanOrEqual(3);
      for (const starter of TWO_D_STARTERS) {
        expect(screen.getByText(starter.name)).toBeInTheDocument();
      }
    });

    it('gives every 2D starter a visible thumbnail', () => {
      const { container } = render(
        <ImportStage
          onSelectSample={vi.fn()}
          onFilesSelected={vi.fn()}
          onImageSelected={vi.fn()}
          hasModel={false}
          loadedModelLabel={null}
        />,
      );
      const thumbnails = container.querySelectorAll('.starter-card__thumb');
      expect(thumbnails.length).toBe(TWO_D_STARTERS.length);
    });

    it('states the starters are originals and free to use', () => {
      render(
        <ImportStage
          onSelectSample={vi.fn()}
          onFilesSelected={vi.fn()}
          onImageSelected={vi.fn()}
          hasModel={false}
          loadedModelLabel={null}
        />,
      );
      expect(screen.getByText(/original starter art/i)).toBeInTheDocument();
      expect(screen.getByText(/free to use/i)).toBeInTheDocument();
    });

    it('routes a selected 2D starter through the same image path as a dropped file', async () => {
      stubCanvasDrawing();
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
      const starter = TWO_D_STARTERS[0];
      expect(starter).toBeDefined();
      await userEvent.click(screen.getByText(starter!.name));
      expect(onImageSelected).toHaveBeenCalledTimes(1);
      const call = onImageSelected.mock.calls[0];
      expect(call).toBeDefined();
      const [file] = call!;
      expect(file).toBeInstanceOf(File);
      expect((file as File).type).toBe('image/png');
    });
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
});
