/**
 * Versioned project-settings schema. A project JSON captures everything
 * needed to reopen the app in the same state *except* the original mesh
 * (see docs/DECISIONS.md for why raw geometry is not embedded) -- reopening
 * a project re-prompts for the source file if it isn't a built-in sample.
 */
import type { ColorMode, ReliefSettings } from './types';
import type { CalibrationProfile } from './calibration';

export const PROJECT_SCHEMA_VERSION = 1 as const;

export interface ProjectFile {
  schemaVersion: 1;
  appVersion: string;
  createdAt: string; // ISO 8601
  sourceModel: {
    kind: 'built-in-sample' | 'user-file';
    sampleId?: string;
    /** Filename only, for display -- the file itself is never embedded. */
    originalFilename?: string;
  };
  patternDimensions: { widthCm: number; heightCm: number; lockAspect: boolean };
  projection: {
    viewpoint: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'custom';
    cameraQuaternion: [number, number, number, number];
    orthographic: true;
  };
  reliefSettings: ReliefSettings;
  heightMapping: { needleSettingNumberByLevel: number[]; calibrationProfileId: string };
  colorMode: ColorMode;
  colorMapping: { swatchColorsHex: string[]; yarnNames: string[] };
  calibrationProfile: CalibrationProfile;
  renderSettings: {
    pileStyle: 'loop' | 'cut';
    density: number;
    yarnThickness: number;
    fabricColorHex: string;
    lightingAzimuthDeg: number;
    lightingElevationDeg: number;
  };
  exportSettings: {
    pageSize: 'a4' | 'letter' | 'actual-size';
    overlapCm: number;
    orientation: 'front' | 'mirrored';
    /** Iteration 02 Stage C. Optional and defaulted at load time (not
     * deep-validated by `parseProjectFile`, same as every other field of
     * this nested object) -- schema v1 project files saved before Stage C
     * won't have this key at all, and load as "no punch guide" rather than
     * failing to parse. Deliberately *not* a schema-version bump; see
     * docs/DECISIONS.md for the (a)-vs-(b) reasoning. */
    punchGuide?: { mode: 'none' | 'dots'; spacingCm: number };
  };
}

export class UnsupportedSchemaVersionError extends Error {
  constructor(found: number) {
    super(
      `This project file was saved with a newer format (schema v${found}) than this app supports ` +
        `(v${PROJECT_SCHEMA_VERSION}). Update the app, or re-create the project from the source model.`,
    );
    this.name = 'UnsupportedSchemaVersionError';
  }
}

export class InvalidProjectFileError extends Error {
  constructor(reason: string) {
    super(`Invalid project file: ${reason}`);
    this.name = 'InvalidProjectFileError';
  }
}

/** Structural validation without a schema library -- keeps the dependency
 * list small (decision recorded in docs/DECISIONS.md). */
export function parseProjectFile(json: unknown): ProjectFile {
  if (typeof json !== 'object' || json === null) {
    throw new InvalidProjectFileError('root value is not an object');
  }
  const obj = json as Record<string, unknown>;
  if (typeof obj.schemaVersion !== 'number') {
    throw new InvalidProjectFileError('missing numeric "schemaVersion"');
  }
  if (obj.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersionError(obj.schemaVersion);
  }
  for (const field of [
    'patternDimensions',
    'projection',
    'reliefSettings',
    'heightMapping',
    'colorMode',
    'colorMapping',
    'calibrationProfile',
    'renderSettings',
    'exportSettings',
  ]) {
    if (!(field in obj)) throw new InvalidProjectFileError(`missing required field "${field}"`);
  }
  return obj as unknown as ProjectFile;
}
