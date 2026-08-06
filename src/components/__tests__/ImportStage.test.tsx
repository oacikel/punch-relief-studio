import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportStage } from '../stages/ImportStage';

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
