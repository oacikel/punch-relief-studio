import { useState } from 'react';
import {
  addNeedleSetting,
  createDefaultProfile,
  MAX_NEEDLE_SETTINGS,
  MIN_NEEDLE_SETTINGS,
  removeNeedleSetting,
  validateProfile,
  type CalibrationProfile,
  type NeedleSetting,
} from '@/domain/calibration';
import { cm } from '@/domain/units';
import { generateCalibrationStrip } from '@/domain/calibrationStrip';
import { downloadSvg } from '@/export/download';
import { exportCalibrationProfile } from '@/export/calibrationExport';

interface Props {
  profile: CalibrationProfile;
  savedProfiles: CalibrationProfile[];
  onChange: (profile: CalibrationProfile) => void;
  onSave: (profile: CalibrationProfile) => void;
  onSelectSaved: (profile: CalibrationProfile) => void;
}

/** CRUD editor for a calibration profile: name/needle/yarn metadata,
 * per-setting measured heights, the calibration-strip generator, and JSON
 * import/export. Validation errors are shown inline, tied to their field. */
export function CalibrationEditor({
  profile,
  savedProfiles,
  onChange,
  onSave,
  onSelectSaved,
}: Props): JSX.Element {
  const errors = validateProfile(profile);
  const errorsByField = new Map(errors.map((e) => [e.field, e.message]));
  const [importError, setImportError] = useState<string | null>(null);

  const updateSetting = (settingNumber: number, patch: Partial<NeedleSetting>): void => {
    onChange({
      ...profile,
      settings: profile.settings.map((s) =>
        s.settingNumber === settingNumber ? { ...s, ...patch } : s,
      ),
    });
  };

  // Add/remove needle settings, up to MAX_NEEDLE_SETTINGS (12, matching the
  // widened height-levels range -- see docs/DECISIONS.md). The actual
  // profile-mutation rules (next-number derivation, min/max bounds) live in
  // src/domain/calibration.ts, not here -- per CLAUDE.md, components call
  // domain functions rather than containing calibration math inline. Real
  // add/remove UI rather than a fixed 12-slot stub (docs/ITERATION_02_PLAN.md
  // §10/§14 decision #3) -- most needles have far fewer than 12 real
  // settings, so padding every profile with unused "not yet measured" rows
  // would be dishonest padding, not help.
  const addSetting = (): void => onChange(addNeedleSetting(profile));
  const removeSetting = (settingNumber: number): void =>
    onChange(removeNeedleSetting(profile, settingNumber));

  const handleImport = async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CalibrationProfile;
      if (!parsed.settings || !Array.isArray(parsed.settings)) {
        throw new Error('File does not look like a calibration profile.');
      }
      onChange(parsed);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import this file.');
    }
  };

  return (
    <div>
      <div className="field">
        <label htmlFor="cal-select">Saved profiles</label>
        <select
          id="cal-select"
          onChange={(e) => {
            const found = savedProfiles.find((p) => p.id === e.target.value);
            if (found) onSelectSaved(found);
          }}
          value={profile.id}
        >
          <option value={profile.id}>{profile.profileName} (current)</option>
          {savedProfiles
            .filter((p) => p.id !== profile.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.profileName}
              </option>
            ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="cal-name">Profile name</label>
        <input
          id="cal-name"
          value={profile.profileName}
          onChange={(e) =>
            onChange({ ...profile, profileName: e.target.value, calibrated: profile.calibrated })
          }
          aria-invalid={errorsByField.has('profileName')}
          aria-describedby={errorsByField.has('profileName') ? 'cal-name-error' : undefined}
        />
        {errorsByField.has('profileName') && (
          <p id="cal-name-error" role="alert" className="helper-text">
            {errorsByField.get('profileName')}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="cal-needle">Needle name</label>
        <input
          id="cal-needle"
          value={profile.needleName}
          onChange={(e) => onChange({ ...profile, needleName: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="cal-yarn">Yarn name</label>
        <input
          id="cal-yarn"
          value={profile.yarnName}
          onChange={(e) => onChange({ ...profile, yarnName: e.target.value })}
        />
      </div>

      <table className="legend-table">
        <caption className="helper-text">Needle settings and measured pile heights</caption>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">Label</th>
            <th scope="col">Measured height (cm)</th>
            <th scope="col">
              <span className="visually-hidden">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {profile.settings.map((s) => (
            <tr key={s.settingNumber}>
              <th scope="row">{s.settingNumber}</th>
              <td>
                <label className="visually-hidden" htmlFor={`label-${s.settingNumber}`}>
                  Label for setting {s.settingNumber}
                </label>
                <input
                  id={`label-${s.settingNumber}`}
                  value={s.label}
                  onChange={(e) => updateSetting(s.settingNumber, { label: e.target.value })}
                />
              </td>
              <td>
                <label className="visually-hidden" htmlFor={`height-${s.settingNumber}`}>
                  Measured height in centimetres for setting {s.settingNumber}
                </label>
                <input
                  id={`height-${s.settingNumber}`}
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="not measured"
                  value={s.measuredHeightCm ?? ''}
                  onChange={(e) =>
                    updateSetting(s.settingNumber, {
                      measuredHeightCm: e.target.value === '' ? null : cm(Number(e.target.value)),
                    })
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => removeSetting(s.settingNumber)}
                  disabled={profile.settings.length <= MIN_NEEDLE_SETTINGS}
                  aria-label={`Remove needle setting ${s.settingNumber}`}
                  title={
                    profile.settings.length <= MIN_NEEDLE_SETTINGS
                      ? 'A profile needs at least one needle setting.'
                      : undefined
                  }
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={addSetting}
          disabled={profile.settings.length >= MAX_NEEDLE_SETTINGS}
          title={
            profile.settings.length >= MAX_NEEDLE_SETTINGS
              ? `A profile can have at most ${MAX_NEEDLE_SETTINGS} needle settings.`
              : undefined
          }
        >
          Add needle setting
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <button type="button" onClick={() => onSave(profile)} disabled={errors.length > 0}>
          Save profile
        </button>
        <button type="button" onClick={() => onChange(createDefaultProfile())}>
          Reset to default (uncalibrated)
        </button>
        <button
          type="button"
          onClick={() => {
            const strip = generateCalibrationStrip(profile);
            downloadSvg(strip.svg, `${profile.profileName}-calibration-strip`);
          }}
        >
          Print calibration strip
        </button>
        <button type="button" onClick={() => exportCalibrationProfile(profile)}>
          Export profile JSON
        </button>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Import profile JSON</span>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </label>
      </div>
      {importError && (
        <p role="alert" className="helper-text">
          {importError}
        </p>
      )}
    </div>
  );
}
