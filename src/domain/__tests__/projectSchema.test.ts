import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '../calibration';
import { DEFAULT_RELIEF_SETTINGS } from '../types';
import {
  InvalidProjectFileError,
  PROJECT_SCHEMA_VERSION,
  UnsupportedSchemaVersionError,
  parseProjectFile,
  type ProjectFile,
} from '../projectSchema';

function makeValidProject(): ProjectFile {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    appVersion: '0.1.0',
    createdAt: new Date().toISOString(),
    sourceModel: { kind: 'built-in-sample', sampleId: 'sample-ripple' },
    patternDimensions: { widthCm: 20, heightCm: 20, lockAspect: true },
    projection: { viewpoint: 'front', cameraQuaternion: [0, 0, 0, 1], orthographic: true },
    reliefSettings: DEFAULT_RELIEF_SETTINGS,
    heightMapping: {
      needleSettingNumberByLevel: [1, 2, 3, 4],
      calibrationProfileId: 'default-uncalibrated',
    },
    colorMode: 'single',
    colorMapping: { swatchColorsHex: ['#8899aa'], yarnNames: ['Yarn 1'] },
    calibrationProfile: createDefaultProfile(),
    renderSettings: {
      pileStyle: 'loop',
      density: 0.5,
      yarnThickness: 0.5,
      fabricColorHex: '#f0ece0',
      lightingAzimuthDeg: 45,
      lightingElevationDeg: 45,
    },
    exportSettings: { pageSize: 'a4', overlapCm: 1, orientation: 'front' },
  };
}

describe('parseProjectFile', () => {
  it('accepts a well-formed current-version project', () => {
    expect(() => parseProjectFile(makeValidProject())).not.toThrow();
  });

  it('rejects a non-object payload', () => {
    expect(() => parseProjectFile('not an object')).toThrow(InvalidProjectFileError);
    expect(() => parseProjectFile(null)).toThrow(InvalidProjectFileError);
  });

  it('rejects a payload missing schemaVersion', () => {
    const { schemaVersion: _drop, ...rest } = makeValidProject();
    expect(() => parseProjectFile(rest)).toThrow(InvalidProjectFileError);
  });

  it('rejects a future/unsupported schema version with a clean, specific error', () => {
    const project = { ...makeValidProject(), schemaVersion: 99 };
    expect(() => parseProjectFile(project)).toThrow(UnsupportedSchemaVersionError);
  });

  it('rejects a payload missing a required field', () => {
    const project = makeValidProject() as unknown as Record<string, unknown>;
    delete project.calibrationProfile;
    expect(() => parseProjectFile(project)).toThrow(InvalidProjectFileError);
  });
});

describe('parseProjectFile punch guide field (Iteration 02 Stage C)', () => {
  it('accepts an old-style (schema v1, pre-Stage-C) project whose exportSettings has no punchGuide key at all', () => {
    // makeValidProject()'s exportSettings deliberately has no punchGuide
    // field -- this is exactly what every project saved before Stage C
    // looks like. It must keep loading, not fail to parse, per the
    // (a)-vs-(b) schema decision in docs/DECISIONS.md.
    const project = makeValidProject();
    expect('punchGuide' in project.exportSettings).toBe(false);
    const parsed = parseProjectFile(project);
    expect(parsed.exportSettings.punchGuide).toBeUndefined();
  });

  it('accepts and round-trips a project whose exportSettings includes a punchGuide', () => {
    const project = makeValidProject();
    project.exportSettings = {
      ...project.exportSettings,
      punchGuide: { mode: 'dots', spacingCm: 1.5 },
    };
    const parsed = parseProjectFile(project);
    expect(parsed.exportSettings.punchGuide).toEqual({ mode: 'dots', spacingCm: 1.5 });
  });
});

describe('parseProjectFile needleGeometry field (Iteration 04)', () => {
  it('accepts an old-style (pre-Iteration-04) project with no needleGeometry key at all', () => {
    const project = makeValidProject();
    expect('needleGeometry' in project).toBe(false);
    const parsed = parseProjectFile(project);
    expect(parsed.needleGeometry).toBeUndefined();
  });

  it('accepts and round-trips a project whose needleGeometry is set', () => {
    const project = { ...makeValidProject(), needleGeometry: { diameterMm: 2, throwMm: 40 } };
    const parsed = parseProjectFile(project);
    expect(parsed.needleGeometry).toEqual({ diameterMm: 2, throwMm: 40 });
  });
});
