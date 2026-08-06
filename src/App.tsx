import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@/config/branding';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { StageNav } from '@/components/StageNav';
import { Viewport3D, type Viewport3DHandle } from '@/components/Viewport3D';
import { ImportStage } from '@/components/stages/ImportStage';
import { OrientStage } from '@/components/stages/OrientStage';
import { ReliefStage } from '@/components/stages/ReliefStage';
import { HeightStage } from '@/components/stages/HeightStage';
import { ColorStage } from '@/components/stages/ColorStage';
import { PreviewStage } from '@/components/stages/PreviewStage';
import { ExportStage } from '@/components/stages/ExportStage';
import { getSampleById } from '@/domain/samples';
import { meshDataToGeometry } from '@/three/sampleAdapter';
import { parseStlFile } from '@/domain/import/stlLoader';
import { parseObjWithAssets } from '@/domain/import/objLoader';
import { assignSingleColor, assignColorByHeight } from '@/domain/color/colorMode';
import { buildLegend } from '@/domain/pattern/legend';
import { useProcessingWorker } from '@/hooks/useProcessingWorker';
import { appReducer, initialAppState, DEFAULT_SINGLE_COLOR } from '@/state/appState';
import { workflowReducer, initialWorkflowState } from '@/state/workflow';
import { loadProfiles, upsertProfile } from '@/persistence/calibrationStore';
import { serializeProject, projectFilename } from '@/persistence/projectStore';
import { downloadText } from '@/export/download';
import { PROJECT_SCHEMA_VERSION, type ProjectFile } from '@/domain/projectSchema';
import type { ColorSwatch, RegionMap, RgbColor } from '@/domain/types';

export default function App(): JSX.Element {
  const [workflow, dispatchWorkflow] = useReducer(workflowReducer, undefined, initialWorkflowState);
  const [state, dispatch] = useReducer(appReducer, undefined, initialAppState);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const viewportHandle = useRef<Viewport3DHandle | null>(null);
  const { process } = useProcessingWorker();

  useEffect(() => {
    dispatch({ type: 'SET_SAVED_PROFILES', profiles: loadProfiles() });
  }, []);

  const handleSelectSample = (sampleId: string): void => {
    const sample = getSampleById(sampleId);
    if (!sample) return;
    setGeometry(meshDataToGeometry(sample.generate()));
    dispatch({ type: 'SET_SOURCE', sourceKind: 'built-in-sample', sampleId });
    dispatchWorkflow({ type: 'MODEL_LOADED' });
    dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'orient' });
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
            for (let i = 0; i < pos.count; i++) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
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
      dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'orient' });
    } catch (err) {
      setImportWarning(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const handleGenerateRelief = async (): Promise<void> => {
    const handle = viewportHandle.current;
    if (!handle) return;
    dispatch({ type: 'PROCESSING_STARTED' });
    try {
      const captured = handle.capture(state.reliefSettings.outputResolutionPx, state.colorMode === 'source-material');
      if (!captured) throw new Error('Nothing to capture yet -- load a model first.');
      // exactOptionalPropertyTypes forbids `color: undefined` -- omit the
      // key entirely rather than assigning an undefined value to it.
      const result = await process({
        depth: captured.depth,
        width: captured.width,
        height: captured.height,
        emptyValue: captured.emptyValue,
        settings: state.reliefSettings,
        ...(captured.color && state.colorMode === 'source-material'
          ? { color: { data: captured.color, channels: 4 as const, paletteSize: state.paletteSize, seed: state.reliefSettings.seed } }
          : {}),
      });
      dispatch({
        type: 'PROCESSING_SUCCEEDED',
        result: {
          width: captured.width,
          height: captured.height,
          heightIndex: result.heightIndex,
          colorIndex: result.colorIndex ?? new Int16Array(result.heightIndex.length).fill(0),
          levels: result.levels,
        },
      });
      dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'height' });
    } catch (err) {
      dispatch({ type: 'PROCESSING_FAILED', message: err instanceof Error ? err.message : String(err) });
    }
  };

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
                Uint8Array.from(Array.from(state.processed.heightIndex).map((v) => (v >= 0 ? 1 : 0))),
                state.swatches[0]?.color ?? DEFAULT_SINGLE_COLOR,
                state.swatches[0]?.yarnName,
              ).colorIndex
            : state.processed.colorIndex,
    };
  }, [state.processed, state.colorMode, state.swatches]);

  const legend = useMemo(() => {
    if (!state.processed) return [];
    return buildLegend(state.swatches, state.processed.levels, state.calibrationProfile);
  }, [state.processed, state.swatches, state.calibrationProfile]);

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
          ? { kind: 'built-in-sample' as const, ...(state.sampleId ? { sampleId: state.sampleId } : {}) }
          : { kind: 'user-file' as const, ...(state.sourceFilename ? { originalFilename: state.sourceFilename } : {}) },
      patternDimensions: state.patternDimensions,
      projection: { viewpoint: 'front', cameraQuaternion: [0, 0, 0, 1], orthographic: true },
      reliefSettings: state.reliefSettings,
      heightMapping: {
        needleSettingNumberByLevel: (state.processed?.levels ?? []).map((l) => l.index + 1),
        calibrationProfileId: state.calibrationProfile.id,
      },
      colorMode: state.colorMode,
      colorMapping: {
        swatchColorsHex: state.swatches.map((s) => `#${s.color.r.toString(16).padStart(2, '0')}${s.color.g.toString(16).padStart(2, '0')}${s.color.b.toString(16).padStart(2, '0')}`),
        yarnNames: state.swatches.map((s) => s.yarnName),
      },
      calibrationProfile: state.calibrationProfile,
      renderSettings: state.renderSettings,
      exportSettings: state.exportSettings,
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
    dispatch({ type: 'SET_EXPORT_SETTINGS', settings: project.exportSettings });
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
        <main>
          {workflow.currentStage === 'import' && (
            <>
              <ImportStage onSelectSample={handleSelectSample} onFilesSelected={(files) => void handleFilesSelected(files)} />
              {importWarning && (
                <p role="alert" className="warning-banner" style={{ margin: '0 24px' }}>
                  {importWarning}
                </p>
              )}
            </>
          )}

          {workflow.currentStage === 'orient' && (
            <OrientStage>
              <Viewport3D geometry={geometry} onReady={(h) => (viewportHandle.current = h)} />
            </OrientStage>
          )}

          {workflow.currentStage === 'relief' && (
            <ReliefStage
              settings={state.reliefSettings}
              onChange={(patch) => dispatch({ type: 'SET_RELIEF_SETTINGS', settings: patch })}
              onGenerate={() => void handleGenerateRelief()}
              processing={state.processing}
              error={state.processingError}
            >
              <Viewport3D geometry={geometry} onReady={(h) => (viewportHandle.current = h)} />
            </ReliefStage>
          )}

          {workflow.currentStage === 'height' && state.processed && (
            <HeightStage
              levels={state.processed.levels}
              heightIndex={state.processed.heightIndex}
              width={state.processed.width}
              height={state.processed.height}
              minRegionPx={state.reliefSettings.minRegionPx}
              profile={state.calibrationProfile}
            />
          )}

          {workflow.currentStage === 'color' && state.processed && (
            <ColorStage
              mode={state.colorMode}
              swatches={state.swatches}
              paletteSize={state.paletteSize}
              levelCount={state.processed.levels.length}
              hasSourceColor={state.processed.colorIndex.some((v) => v >= 0)}
              onModeChange={(mode) => dispatch({ type: 'SET_COLOR_MODE', mode })}
              onSwatchesChange={(swatches) => dispatch({ type: 'SET_SWATCHES', swatches })}
              onPaletteSizeChange={(size) => dispatch({ type: 'SET_PALETTE_SIZE', size })}
            />
          )}

          {workflow.currentStage === 'preview' && state.processed && regionMap && (
            <PreviewStage
              regionMap={regionMap}
              levels={state.processed.levels}
              legend={legend}
              profile={state.calibrationProfile}
              dimensions={state.patternDimensions}
              renderSettings={state.renderSettings}
              onRenderSettingsChange={(patch) => dispatch({ type: 'SET_RENDER_SETTINGS', settings: patch })}
            />
          )}

          {workflow.currentStage === 'export' && regionMap && (
            <ExportStage
              regionMap={regionMap}
              legend={legend}
              dimensions={state.patternDimensions}
              onDimensionsChange={(patch) => dispatch({ type: 'SET_PATTERN_DIMENSIONS', dimensions: patch })}
              exportSettings={state.exportSettings}
              onExportSettingsChange={(patch) => dispatch({ type: 'SET_EXPORT_SETTINGS', settings: patch })}
              calibrationProfile={state.calibrationProfile}
              savedProfiles={state.savedProfiles}
              onCalibrationChange={(profile) => dispatch({ type: 'SET_CALIBRATION_PROFILE', profile })}
              onCalibrationSave={(profile) => {
                const profiles = upsertProfile(profile);
                dispatch({ type: 'SET_SAVED_PROFILES', profiles });
              }}
              onCalibrationSelect={(profile) => dispatch({ type: 'SET_CALIBRATION_PROFILE', profile })}
              onSaveProjectJson={handleSaveProjectJson}
              onLoadProjectJson={handleLoadProjectJson}
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
