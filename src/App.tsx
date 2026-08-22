import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@/config/branding';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StageNav } from '@/components/StageNav';
import { Viewport3D, type Viewport3DHandle } from '@/components/Viewport3D';
import { ImportStage, ImportOrientSection } from '@/components/stages/ImportStage';
import { Workspace } from '@/components/workspace/Workspace';
import { getSampleById } from '@/domain/samples';
import { meshDataToGeometry } from '@/three/sampleAdapter';
import { parseStlFile } from '@/domain/import/stlLoader';
import { parseObjWithAssets } from '@/domain/import/objLoader';
import { assignSingleColor, assignColorByHeight } from '@/domain/color/colorMode';
import { applyPaletteToSwatches, getPaletteById } from '@/domain/color/palettes';
import { buildLegend } from '@/domain/pattern/legend';
import { useProcessingWorker, type ProcessArgs } from '@/hooks/useProcessingWorker';
import { useLiveRelief } from '@/hooks/useLiveRelief';
import { appReducer, initialAppState, DEFAULT_SINGLE_COLOR } from '@/state/appState';
import { DEFAULT_PUNCH_GUIDE_SPACING_CM } from '@/domain/pattern/punchGuide';
import { workflowReducer, initialWorkflowState } from '@/state/workflow';
import { loadProfiles } from '@/persistence/calibrationStore';
import { serializeProject, projectFilename } from '@/persistence/projectStore';
import { downloadText } from '@/export/download';
import { PROJECT_SCHEMA_VERSION, type ProjectFile } from '@/domain/projectSchema';
import type { DepthCaptureResult } from '@/three/depthCapture';
import type { ColorSwatch, RegionMap, RgbColor } from '@/domain/types';

export default function App(): JSX.Element {
  const [workflow, dispatchWorkflow] = useReducer(workflowReducer, undefined, initialWorkflowState);
  const [state, dispatch] = useReducer(appReducer, undefined, initialAppState);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const viewportHandle = useRef<Viewport3DHandle | null>(null);
  const { process } = useProcessingWorker();

  // Loads any locally-saved calibration profiles into state even though
  // there's currently no UI surface that reads state.savedProfiles --
  // calibration UI was removed app-wide by explicit, reversible product
  // decision (docs/ITERATION_03_PLAN.md #6), but the underlying
  // persistence/domain layer stays fully wired so a future UI can read
  // real saved data immediately, not just be "reconnected but empty".
  useEffect(() => {
    dispatch({ type: 'SET_SAVED_PROFILES', profiles: loadProfiles() });
  }, []);

  const handleSelectSample = (sampleId: string): void => {
    const sample = getSampleById(sampleId);
    if (!sample) return;
    setGeometry(meshDataToGeometry(sample.generate()));
    dispatch({ type: 'SET_SOURCE', sourceKind: 'built-in-sample', sampleId });
    dispatchWorkflow({ type: 'MODEL_LOADED' });
    // Iteration 02 Stage A: orientation now happens on the Import stage
    // itself (see ImportOrientSection below) -- no separate stage to
    // navigate to. The user is already on 'import'.
  };

  const handleFilesSelected = async (files: File[]): Promise<void> => {
    setImportWarning(null);
    const stl = files.find((f) => /\.stl$/i.test(f.name));
    const obj = files.find((f) => /\.obj$/i.test(f.name));
    try {
      if (stl) {
        const geo = await parseStlFile(stl);
        setGeometry(geo);
        dispatch({ type: 'SET_SOURCE', sourceKind: 'user-file', filename: stl.name });
      } else if (obj) {
        const others = files.filter((f) => f !== obj);
        const result = await parseObjWithAssets(obj, others);
        if (result.warnings.length > 0) setImportWarning(result.warnings.join(' '));
        const merged = new THREE.BufferGeometry();
        const positions: number[] = [];
        result.object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const pos = child.geometry.getAttribute('position');
            for (let i = 0; i < pos.count; i++)
              positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
          }
        });
        merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        merged.computeVertexNormals();
        setGeometry(merged);
        dispatch({ type: 'SET_SOURCE', sourceKind: 'user-file', filename: obj.name });
      } else {
        setImportWarning('No .stl or .obj file found among the dropped files.');
        return;
      }
      dispatchWorkflow({ type: 'MODEL_LOADED' });
      // See handleSelectSample above -- already on 'import', which now
      // shows the orientation section once hasModel is true.
    } catch (err) {
      setImportWarning(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  // Live regeneration (Iteration 03's combined-workspace change -- see
  // docs/ITERATION_03_PLAN.md #13 and docs/DECISIONS.md), replacing the
  // former manual "Generate relief" button. `useLiveRelief` owns the
  // debounce + generation-counter orchestration; this component supplies
  // the three injected primitives (capture/buildProcessArgs/process) and
  // is where the actual ProcessArgs shape is assembled, matching the old
  // handleGenerateRelief's payload construction verbatim.
  const captureFromViewport = useCallback(
    (resolutionPx: number, captureColor: boolean): DepthCaptureResult | null =>
      viewportHandle.current?.capture(resolutionPx, captureColor) ?? null,
    [],
  );

  const buildProcessArgs = useCallback(
    (captured: DepthCaptureResult): ProcessArgs => ({
      depth: captured.depth,
      width: captured.width,
      height: captured.height,
      emptyValue: captured.emptyValue,
      settings: state.reliefSettings,
      // exactOptionalPropertyTypes forbids `color: undefined` -- omit the
      // key entirely rather than assigning an undefined value to it.
      ...(captured.color && state.colorMode === 'source-material'
        ? {
            color: {
              data: captured.color,
              channels: 4 as const,
              paletteSize: state.paletteSize,
              seed: state.reliefSettings.seed,
            },
          }
        : {}),
    }),
    [state.reliefSettings, state.colorMode, state.paletteSize],
  );

  useLiveRelief({
    hasModel: workflow.hasModel,
    reliefSettings: state.reliefSettings,
    rotationDeg: state.modelRotationDeg,
    captureColor: state.colorMode === 'source-material',
    capture: captureFromViewport,
    buildProcessArgs,
    process,
    onStart: () => dispatch({ type: 'PROCESSING_STARTED' }),
    onSuccess: (result, capturedWidth, capturedHeight) =>
      dispatch({
        type: 'PROCESSING_SUCCEEDED',
        result: {
          width: capturedWidth,
          height: capturedHeight,
          heightIndex: result.heightIndex,
          colorIndex: result.colorIndex ?? new Int16Array(result.heightIndex.length).fill(0),
          levels: result.levels,
        },
      }),
    onError: (message) => dispatch({ type: 'PROCESSING_FAILED', message }),
  });

  const regionMap: RegionMap | null = useMemo(() => {
    if (!state.processed) return null;
    return {
      width: state.processed.width,
      height: state.processed.height,
      heightIndex: state.processed.heightIndex,
      colorIndex:
        state.colorMode === 'by-height'
          ? assignColorByHeight(
              state.processed.heightIndex,
              state.processed.levels.length,
              state.swatches.map((s) => s.color),
              state.swatches.map((s) => s.yarnName),
            ).colorIndex
          : state.colorMode === 'single'
            ? assignSingleColor(
                state.processed.heightIndex.length,
                Uint8Array.from(
                  Array.from(state.processed.heightIndex).map((v) => (v >= 0 ? 1 : 0)),
                ),
                state.swatches[0]?.color ?? DEFAULT_SINGLE_COLOR,
                state.swatches[0]?.yarnName,
              ).colorIndex
            : state.processed.colorIndex,
    };
  }, [state.processed, state.colorMode, state.swatches]);

  const legend = useMemo(() => {
    if (!state.processed || !regionMap) return [];
    return buildLegend(state.swatches, state.processed.levels, state.calibrationProfile, regionMap);
  }, [state.processed, state.swatches, state.calibrationProfile, regionMap]);

  const handleSaveProjectJson = (): void => {
    const project: ProjectFile = {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      appVersion: APP_VERSION,
      createdAt: new Date().toISOString(),
      // exactOptionalPropertyTypes forbids assigning `undefined` to an
      // optional field -- omit sampleId/originalFilename entirely when
      // there's no value, rather than setting them to undefined.
      sourceModel:
        state.sourceKind === 'built-in-sample'
          ? {
              kind: 'built-in-sample' as const,
              ...(state.sampleId ? { sampleId: state.sampleId } : {}),
            }
          : {
              kind: 'user-file' as const,
              ...(state.sourceFilename ? { originalFilename: state.sourceFilename } : {}),
            },
      patternDimensions: state.patternDimensions,
      projection: { viewpoint: 'front', cameraQuaternion: [0, 0, 0, 1], orthographic: true },
      reliefSettings: state.reliefSettings,
      heightMapping: {
        needleSettingNumberByLevel: (state.processed?.levels ?? []).map((l) => l.index + 1),
        calibrationProfileId: state.calibrationProfile.id,
      },
      colorMode: state.colorMode,
      colorMapping: {
        swatchColorsHex: state.swatches.map(
          (s) =>
            `#${s.color.r.toString(16).padStart(2, '0')}${s.color.g.toString(16).padStart(2, '0')}${s.color.b.toString(16).padStart(2, '0')}`,
        ),
        yarnNames: state.swatches.map((s) => s.yarnName),
      },
      calibrationProfile: state.calibrationProfile,
      renderSettings: state.renderSettings,
      // Iteration 02 Stage C: `punchGuide` is the one field of
      // `patternViewSettings` that's actually persisted -- Stage D needs it
      // to reprint the same guide a saved project was made with.
      // `showOnScreenLabels` deliberately stays AppState-only (see
      // docs/DECISIONS.md), matching the existing view/showLabels
      // precedent already on this same `exportSettings` object.
      // `modelRotationDeg` is deliberately NOT included here either --
      // straightening is a per-import adjustment, not project data (see
      // docs/DECISIONS.md).
      exportSettings: { ...state.exportSettings, punchGuide: state.patternViewSettings.punchGuide },
    };
    downloadText(serializeProject(project), projectFilename('punch-relief'), 'application/json');
  };

  /** Restore settings from a reopened project JSON. Per docs/DECISIONS.md,
   * the original mesh is never embedded in the project file -- if the
   * project was made from a user-imported model (not a built-in sample),
   * the user still needs to re-select that file in the Import stage. */
  const handleLoadProjectJson = (project: ProjectFile): void => {
    dispatch({ type: 'SET_RELIEF_SETTINGS', settings: project.reliefSettings });
    dispatch({ type: 'SET_COLOR_MODE', mode: project.colorMode });
    const swatches: ColorSwatch[] = project.colorMapping.swatchColorsHex.map((hex, i) => ({
      index: i,
      color: hexToRgb(hex),
      yarnName: project.colorMapping.yarnNames[i] ?? `Yarn ${i + 1}`,
    }));
    if (swatches.length > 0) dispatch({ type: 'SET_SWATCHES', swatches });
    dispatch({ type: 'SET_CALIBRATION_PROFILE', profile: project.calibrationProfile });
    dispatch({ type: 'SET_PATTERN_DIMENSIONS', dimensions: project.patternDimensions });
    dispatch({ type: 'SET_RENDER_SETTINGS', settings: project.renderSettings });
    // `ExportSettings` (AppState) has no `punchGuide` field -- it lives
    // separately on `patternViewSettings` (see below) -- so pick only the
    // fields `ExportSettings` actually declares, rather than spreading the
    // whole `project.exportSettings` object (which now types an optional
    // `punchGuide`) wholesale into a `Partial<ExportSettings>` action.
    // Passing the raw object still type-checked (excess-property checking
    // doesn't apply to values, only literals) but would have left an
    // untyped, unused `punchGuide` key sitting on `state.exportSettings`
    // alongside the real one on `state.patternViewSettings.punchGuide` --
    // two sources of truth for the same setting, found in independent
    // review.
    dispatch({
      type: 'SET_EXPORT_SETTINGS',
      settings: {
        pageSize: project.exportSettings.pageSize,
        overlapCm: project.exportSettings.overlapCm,
        orientation: project.exportSettings.orientation,
      },
    });
    // Iteration 02 Stage C schema decision (a): old (pre-Stage-C) project
    // files never have `exportSettings.punchGuide` -- default explicitly
    // to "no guide" rather than trusting `??` alone to "just work" without
    // a test proving the old-file path. See docs/DECISIONS.md.
    dispatch({
      type: 'SET_PATTERN_VIEW_SETTINGS',
      punchGuide: project.exportSettings.punchGuide ?? {
        mode: 'none',
        spacingCm: DEFAULT_PUNCH_GUIDE_SPACING_CM,
      },
    });
    if (project.sourceModel.kind === 'built-in-sample' && project.sourceModel.sampleId) {
      handleSelectSample(project.sourceModel.sampleId);
    }
  };

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <header className="app-header">
          <h1>{APP_NAME}</h1>
          <p>{APP_TAGLINE}</p>
        </header>
        <StageNav
          current={workflow.currentStage}
          hasModel={workflow.hasModel}
          onSelect={(stage) => dispatchWorkflow({ type: 'GO_TO_STAGE', stage })}
        />
        {/* Iteration 03's combined-workspace change: on 'workspace', this
            becomes a sticky two-column layout (control rail left, preview
            column right) via the `workspace-layout` class alone -- renamed
            from `relief-layout` (see docs/DECISIONS.md), same mechanism.
            A class toggle on this same, always-present <main> element
            (rather than a new conditional wrapper) is used so it cannot
            affect reconciliation of the shared Viewport3D instance below,
            which must never remount when navigating between Import and
            Workspace (see e2e/orient-persistence.spec.ts) -- capture()
            depends on that same live WebGL scene staying alive. */}
        <main className={workflow.currentStage === 'workspace' ? 'workspace-layout' : undefined}>
          {workflow.currentStage === 'import' && (
            <>
              <ImportStage
                onSelectSample={handleSelectSample}
                onFilesSelected={(files) => void handleFilesSelected(files)}
              />
              {importWarning && (
                <p role="alert" className="warning-banner" style={{ margin: '0 24px' }}>
                  {importWarning}
                </p>
              )}
              {workflow.hasModel && (
                <ImportOrientSection
                  onContinue={() => dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'workspace' })}
                />
              )}
            </>
          )}

          {/* Rendered once, unconditionally, for both stages that need it, so
              the orientation/rotation chosen on Import survives navigating on
              to Workspace instead of resetting to the default camera on
              remount, and so `capture()` keeps working from wherever
              Workspace's live-regeneration hook calls it. Guarded by
              hasModel. On 'workspace', the wrapper is visually hidden (the
              mockup's right column shows Pattern + Simulation panels, not
              the raw-model viewport) via `.visually-hidden` -- deliberately
              NOT `display:none`, since the WebGL render loop and
              `ResizeObserver` stay attached to a real (if 1x1) element --
              and `aria-hidden` so the otherwise-still-announced
              `role="img"` landmark doesn't linger as a phantom for screen
              reader users while off-screen. `showControls={false}` there
              also un-mounts (not just hides) the standard-view buttons and
              rotation sliders, so there is never a second, duplicate set of
              interactive rotation controls in the DOM alongside Workspace's
              own `SimulationPanel` copy -- see docs/DECISIONS.md. */}
          {(workflow.currentStage === 'import' || workflow.currentStage === 'workspace') &&
            workflow.hasModel && (
              <div
                className={
                  workflow.currentStage === 'workspace'
                    ? 'stage-panel visually-hidden'
                    : 'stage-panel'
                }
                aria-hidden={workflow.currentStage === 'workspace' ? true : undefined}
              >
                <Viewport3D
                  geometry={geometry}
                  onReady={(h) => (viewportHandle.current = h)}
                  rotationDeg={state.modelRotationDeg}
                  onRotationChange={(patch) =>
                    dispatch({ type: 'SET_MODEL_ROTATION', rotation: patch })
                  }
                  showControls={workflow.currentStage === 'import'}
                />
              </div>
            )}

          {workflow.currentStage === 'workspace' && (
            <Workspace
              reliefSettings={state.reliefSettings}
              onReliefSettingsChange={(patch) =>
                dispatch({ type: 'SET_RELIEF_SETTINGS', settings: patch })
              }
              processed={state.processed}
              regionMap={regionMap}
              legend={legend}
              colorMode={state.colorMode}
              swatches={state.swatches}
              paletteSize={state.paletteSize}
              hasSourceColor={
                state.processed ? state.processed.colorIndex.some((v) => v >= 0) : false
              }
              onColorModeChange={(mode) => dispatch({ type: 'SET_COLOR_MODE', mode })}
              onSwatchesChange={(swatches) => dispatch({ type: 'SET_SWATCHES', swatches })}
              onPaletteSizeChange={(size) => dispatch({ type: 'SET_PALETTE_SIZE', size })}
              onApplyPalette={(paletteId) => {
                const palette = getPaletteById(paletteId);
                if (!palette) return;
                dispatch({
                  type: 'SET_SWATCHES',
                  swatches: applyPaletteToSwatches(state.swatches, palette),
                });
              }}
              profile={state.calibrationProfile}
              dimensions={state.patternDimensions}
              onDimensionsChange={(patch) =>
                dispatch({ type: 'SET_PATTERN_DIMENSIONS', dimensions: patch })
              }
              renderSettings={state.renderSettings}
              onRenderSettingsChange={(patch) =>
                dispatch({ type: 'SET_RENDER_SETTINGS', settings: patch })
              }
              exportSettings={state.exportSettings}
              onExportSettingsChange={(patch) =>
                dispatch({ type: 'SET_EXPORT_SETTINGS', settings: patch })
              }
              onSaveProjectJson={handleSaveProjectJson}
              onLoadProjectJson={handleLoadProjectJson}
              patternViewSettings={state.patternViewSettings}
              onPatternViewSettingsChange={(patch) =>
                dispatch({ type: 'SET_PATTERN_VIEW_SETTINGS', ...patch })
              }
              rotationDeg={state.modelRotationDeg}
              onRotationChange={(patch) =>
                dispatch({ type: 'SET_MODEL_ROTATION', rotation: patch })
              }
              processing={state.processing}
              processingError={state.processingError}
            />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}

function hexToRgb(hex: string): RgbColor {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
