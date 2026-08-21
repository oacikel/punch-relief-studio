import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportStage, ImportOrientSection } from '../stages/ImportStage';

describe('ImportStage', () => {
  it('lists all three built-in samples', () => {
    render(<ImportStage onSelectSample={vi.fn()} onFilesSelected={vi.fn()} />);
    expect(screen.getByText('Concentric Ripple')).toBeInTheDocument();
    expect(screen.getByText('Rounded Relief (Eye)')).toBeInTheDocument();
    expect(screen.getByText('Geometric Steps')).toBeInTheDocument();
  });

  it('calls onSelectSample with the right id when a sample button is clicked', async () => {
    const onSelectSample = vi.fn();
    render(<ImportStage onSelectSample={onSelectSample} onFilesSelected={vi.fn()} />);
    await userEvent.click(screen.getByText('Concentric Ripple'));
    expect(onSelectSample).toHaveBeenCalledWith('sample-ripple');
  });

  it('has an accessible file input for the file picker path', () => {
    render(<ImportStage onSelectSample={vi.fn()} onFilesSelected={vi.fn()} />);
    expect(screen.getByLabelText('Choose model files to import')).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', { name: /Continue to Create Relief/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
