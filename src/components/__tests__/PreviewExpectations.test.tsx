import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewExpectations } from '../stages/PreviewExpectations';

/** EXP-003's treatment surface -- see src/analytics/previewExpectations.ts
 * for the assignment that decides whether it renders at all. */
describe('PreviewExpectations', () => {
  it('names the three things the single-viewpoint pattern will and will not contain', () => {
    render(<PreviewExpectations />);

    expect(screen.getByRole('region', { name: 'What your pattern will show' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(
      screen.getByText(/Only the surfaces facing you above become the pattern/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/relative steps, not millimetres/i)).toBeInTheDocument();
    expect(screen.getByText(/merges into the surface in front of it/i)).toBeInTheDocument();
  });

  it('ties the expectation to what gets exported, which is the confusion it is meant to pre-empt', () => {
    render(<PreviewExpectations />);
    expect(screen.getByText(/What you export is this same single view/i)).toBeInTheDocument();
  });

  it('is copy, not a control -- nothing here can be clicked or dismissed', () => {
    render(<PreviewExpectations />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
