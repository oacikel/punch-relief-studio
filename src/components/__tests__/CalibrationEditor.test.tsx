import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalibrationEditor } from '../CalibrationEditor';
import { createDefaultProfile } from '@/domain/calibration';

/**
 * Iteration 02 Stage B: `CalibrationEditor` previously had no add/remove-
 * setting UI at all, only edit-in-place on whatever `createDefaultProfile()`
 * returned -- see docs/ITERATION_02_PLAN.md §10/§14 decision #3. These
 * tests cover the new add/remove controls, capped at 1-12 settings to match
 * the widened height-levels range (2-12, see docs/DECISIONS.md).
 */
describe('CalibrationEditor add/remove settings', () => {
  it('adds a new needle setting with the next number when "Add needle setting" is clicked', async () => {
    const onChange = vi.fn();
    const profile = createDefaultProfile(); // 4 settings, numbered 1-4
    render(
      <CalibrationEditor
        profile={profile}
        savedProfiles={[]}
        onChange={onChange}
        onSave={vi.fn()}
        onSelectSaved={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Add needle setting' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.arrayContaining([
          expect.objectContaining({ settingNumber: 5, label: 'Setting 5', measuredHeightCm: null }),
        ]) as unknown,
      }),
    );
  });

  it('disables "Add needle setting" once a profile has 12 settings', () => {
    const profile = createDefaultProfile();
    profile.settings = Array.from({ length: 12 }, (_, i) => ({
      settingNumber: i + 1,
      label: `Setting ${i + 1}`,
      measuredHeightCm: null,
    }));
    render(
      <CalibrationEditor
        profile={profile}
        savedProfiles={[]}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSelectSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add needle setting' })).toBeDisabled();
  });

  it('removes a needle setting when its "Remove" button is clicked', async () => {
    const onChange = vi.fn();
    const profile = createDefaultProfile();
    render(
      <CalibrationEditor
        profile={profile}
        savedProfiles={[]}
        onChange={onChange}
        onSave={vi.fn()}
        onSelectSaved={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remove needle setting 2' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: [
          expect.objectContaining({ settingNumber: 1 }),
          expect.objectContaining({ settingNumber: 3 }),
          expect.objectContaining({ settingNumber: 4 }),
        ] as unknown,
      }),
    );
  });

  it('disables removal once only one needle setting remains', () => {
    const profile = createDefaultProfile();
    profile.settings = [{ settingNumber: 1, label: 'only', measuredHeightCm: null }];
    render(
      <CalibrationEditor
        profile={profile}
        savedProfiles={[]}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onSelectSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove needle setting 1' })).toBeDisabled();
  });
});
