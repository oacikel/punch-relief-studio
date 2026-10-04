import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import * as THREE from 'three';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from '@/config/branding';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ModelBar } from '@/components/ModelBar';
import { PrivacyControl } from '@/components/PrivacyControl';
import {
  initAnalytics,
  shouldMoveYarnColorsEarlier,
  shouldShowPreviewExpectations,
  shouldUseExpressLane,
  trackPageViewed,
  trackPatternCompleted,
  trackProjectCreated,
} from '@/analytics';
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
import { PATTERN_RECIPES, type PatternRecipe } from '@/domain/pattern/recipes';
import { useProcessingWorker, type ProcessArgs } from '@/hooks/useProcessingWorker';
import { useLiveRelief } from '@/hooks/useLiveRelief';
import { appReducer, initialAppState, DEFAULT_SINGLE_COLOR } from '@/state/appState';
import { DEFAULT_PUNCH_GUIDE_SPACING_CM } from '@/domain/pattern/punchGuide';
import { workflowReducer, initialWorkflowState } from '@/state/workflow';
import { loadProfiles } from '@/persistence/calibrationStore';
import {
  hasSeenFirstProjectGuide,
  markFirstProjectGuideSeen,
} from '@/persistence/firstProjectGuideStore';
import { serializeProject, projectFilename } from '@/persistence/projectStore';
import { downloadText } from '@/export/download';
import { PROJECT_SCHEMA_VERSION, type ProjectFile } from '@/domain/projectSchema';
import type { DepthCaptureResult } from '@/three/depthCapture';
import type { ColorSwatch, RegionMap, RgbColor } from '@/domain/types';
import { decodeImageFile, type DecodedImage } from '@/image/decodeImage';

export default function App(): JSX.Element {
  const [workflow, dispatchWorkflow] = useReducer(workflowReducer, undefined, initialWorkflowState);
  const [state, dispatch] = useReducer(appReducer, undefined, initialAppState);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [imageRaster, setImageRaster] = useState<DecodedImage | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  // Bumped whenever the 3D viewport's camera is reoriented for a
  // user-driven reason (a standard-view button click, or a settled
  // OrbitControls orbit/pan/zoom) -- see `Viewport3D`'s `onViewChange`
  // prop and `useLiveRelief`'s `viewNonce` option. `applyStandardView`/
  // `OrbitControls` mutate the Three.js camera imperatively with no React
  // state of their own, so without this, `useLiveRelief` (which only
  // re-triggers on `hasModel`/`reliefSettings`/`rotationDeg` changing)
  // never learns the camera moved -- see docs/DECISIONS.md for the full
  // bug account this closes. `useCallback([])` keeps the identity stable
  // across renders; `Viewport3D` also holds its own ref to the latest
  // value regardless (belt-and-braces -- see that component's own doc
  // comment), so this only needs to be "stable enough," not perfectly so.
  const [viewNonce, setViewNonce] = useState(0);
  const onViewChange = useCallback(() => setViewNonce((n) => n + 1), []);
  const viewportHandle = useRef<Viewport3DHandle | null>(null);
  const { process, processImage } = useProcessingWorker();
  const imageProcessGeneration = useRef(0);
  // Read inside the image-processing effect below instead of listing
  // state.colorStoryId as a dependency -- applying a color story shouldn't
  // itself trigger a full image re-simplification (it only needs to be
  // picked up the next time some other setting change re-simplifies).
  const colorStoryIdRef = useRef(state.colorStoryId);
  colorStoryIdRef.current = state.colorStoryId;

  // EXP-003 ("clarify the single-viewpoint preview"): whether this session
  // gets the fuller expectation-setting notice on the Import/Orient step
  // instead of the one-line version. Read once at mount, since the variant
  // is fixed for the session (src/analytics/previewExpectations.ts) and has
  // to be known before the person can reach that step, which is any time
  // after the first import.
  const [previewExpectationsEnabled, setPreviewExpectationsEnabled] = useState(false);

  // EXP-002 ("move yarn palette selection earlier"): whether this session's
  // Workspace rail shows the Yarn step before the Shape step. Read once at
  // mount -- the variant is fixed for the session
  // (src/analytics/paletteOrder.ts), and it has to be known before the
  // Workspace stage first renders.
  const [moveYarnColorsEarlier, setMoveYarnColorsEarlier] = useState(false);

  // EXP-011 ("Express lane: one screen from import to export, with Export
  // always visible"): whether this session's Workspace renders Shape, Yarn
  // and Export together on one screen instead of the gated three-step rail.
  // Link-only (src/analytics/expressLane.ts), read directly from the
  // current URL as well as any cached landing context, so it applies
  // whether or not analytics is configured for this test build.
  const [expressLane, setExpressLane] = useState(false);

  // EXP-012 ("One-click pattern recipes"): true for exactly the one render
  // where a recipe card just applied its shape/detail/palette preset and
  // navigated to Workspace -- read once by Workspace's lazy `editorStep`
  // init (see its `initialEditorStep` prop) so that mount opens straight on
  // Export instead of Shape/Yarn. The effect below flips it back to false
  // immediately after that render commits, so a later, unrelated
  // Import<->Workspace navigation (e.g. via ModelBar's "Change" link)
  // doesn't also jump to Export.
  const [recipeJumpToExport, setRecipeJumpToExport] = useState(false);
  useEffect(() => {
    if (recipeJumpToExport) setRecipeJumpToExport(false);
  }, [recipeJumpToExport]);

  // T10 analytics: a no-op unless VITE_VP_INGEST_URL/VITE_VP_PROJECT_TOKEN
  // are set at build time -- see src/analytics/config.ts and
  // docs/ANALYTICS.md. `page_viewed{path:"/"}` fires once, at mount.
  // `initAnalytics()` also assigns the session's experiment variant, so it
  // must stay ahead of the first event and both variant reads below. EXP-002
  // is live; EXP-003 is dormant, so its UI helper returns the shipped notice.
  // EXP-011 is link-only and read independently of analytics configuration.
  useEffect(() => {
    initAnalytics();
    trackPageViewed('/');
    setMoveYarnColorsEarlier(shouldMoveYarnColorsEarlier());
    setPreviewExpectationsEnabled(shouldShowPreviewExpectations());
    setExpressLane(shouldUseExpressLane());
  }, []);

  // `pattern_completed{durationSeconds}` fires once per project, on the
  // first successful generation after it was created -- these two refs
  // track "when did the current project start" and "have we already sent
  // pattern_completed for it", reset together whenever a new project is
  // created (see markProjectCreated below).
  const projectCreatedAtRef = useRef<number | null>(null);
  const patternCompletedSentRef = useRef(false);

  const markProjectCreated = useCallback((origin: 'sample' | 'import'): void => {
    projectCreatedAtRef.current = Date.now();
    patternCompletedSentRef.current = false;
    trackProjectCreated(origin);
  }, []);

  // EXP-004 ("Show a first-project guide after import"): lazily read once,
  // at mount, so a dismissal during this session doesn't need to re-derive
  // from storage -- same pattern as PrivacyControl.tsx's own `allowed`
  // state. Shown at most once per device (see firstProjectGuideStore.ts),
  // not once per project/session.
  const [showFirstProjectGuide, setShowFirstProjectGuide] = useState(
    () => !hasSeenFirstProjectGuide(),
  );
  const dismissFirstProjectGuide = useCallback((): void => {
    markFirstProjectGuideSeen();
    setShowFirstProjectGuide(false);
  }, []);

  const markPatternCompletedIfFirst = useCallback((): void => {
    if (patternCompletedSentRef.current) return;
    patternCompletedSentRef.current = true;
    const startedAt = projectCreatedAtRef.current;
    const durationSeconds =
      startedAt !== null ? Math.max(0, Math.round((Date.now() - startedAt) / 1000)) : undefined;
    trackPatternCompleted(durationSeconds);
  }, []);

  // Loads any locally-saved calibration profiles into state even though
  // there's currently no UI surface that reads state.savedProfiles --
  // calibration UI was removed app-wide by explicit, reversible product
  // decision (docs/ITERATION_03_PLAN.md #6), but the underlying
  // persistence/domain layer stays fully wired so a future UI can read
  // real saved data immediately, not just be "reconnected but empty".
  useEffect(() => {
    dispatch({ type: 'SET_SAVED_PROFILES', profiles: loadProfiles() });
  }, []);

  useEffect(
    () => () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    },
    [imagePreviewUrl],
  );

  // Workspace two-column redesign: both columns are independently,
  // internally scrollable (`.workspace-controls-col`/`.workspace-preview-col`,
  // each `overflow-y: auto`, capped by `.app-shell--workspace`'s `height:
  // 100vh; overflow: hidden;`) -- there should be no leftover document-
  // level scroll for the page itself to move while on Workspace, at
  // desktop width. Found via real-browser verification that `.app-shell`'s
  // own `overflow: hidden` was not, on its own, enough to stop
  // `document.documentElement` from reporting (and acting on) scrollable
  // overflow beyond one viewport height, even though every one of its own
  // descendants measured correctly bounded. Toggling this class (rather
  // than setting an inline style directly) is deliberate: the actual
  // `overflow: hidden` declaration lives in styles.css scoped inside the
  // same `@media (min-width: 721px)` range the two-column layout itself
  // requires, so this stays inert at the mobile-narrow breakpoint, where
  // the layout falls back to normal single-column, page-scrolled stacking
  // -- an unconditional inline style here would have locked body scroll
  // there too and made that fallback content unreachable, found via the
  // same real-browser verification pass.
  //
  // `window.scrollTo(0, 0)` alongside the lock is required, not defensive
  // padding: `overflow: hidden` only stops *further* scrolling, it does
  // not reset a scroll position the page already has -- and Import
  // legitimately scrolls the page as a normal side effect of navigating it
  // (e.g. an element being scrolled into view before a click), so by the
  // time a user reaches Workspace the document can already be scrolled
  // some way down. Without this reset, the entire two-column layout (which
  // always starts at document y=0) would render effectively above the
  // visible viewport, appearing blank. Found via a real, reproducible
  // failure during this feature's own verification, not a hypothetical.
  //
  // Reset on every stage change and on unmount so Import's normal page
  // scroll is never affected.
  useEffect(() => {
    if (workflow.currentStage !== 'workspace') return;
    window.scrollTo(0, 0);
    document.body.classList.add('workspace-scroll-lock');
    return () => {
      document.body.classList.remove('workspace-scroll-lock');
    };
  }, [workflow.currentStage]);

  // T10 analytics: `page_viewed{path:"/workspace"}` fires each time the
  // workspace stage is entered -- separate effect from the scroll-lock one
  // above so a future change to either doesn't accidentally couple them.
  useEffect(() => {
    if (workflow.currentStage !== 'workspace') return;
    trackPageViewed('/workspace');
  }, [workflow.currentStage]);

  const handleSelectSample = (sampleId: string): void => {
    const sample = getSampleById(sampleId);
    if (!sample) return;
    setGeometry(meshDataToGeometry(sample.generate()));
    setImageRaster(null);
    setImagePreviewUrl(null);
    dispatch({ type: 'SET_SOURCE', sourceKind: 'built-in-sample', sampleId });
    dispatchWorkflow({ type: 'MODEL_LOADED' });
    markProjectCreated('sample');
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
        setImageRaster(null);
        setImagePreviewUrl(null);
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
        setImageRaster(null);
        setImagePreviewUrl(null);
        dispatch({ type: 'SET_SOURCE', sourceKind: 'user-file', filename: obj.name });
      } else {
        setImportWarning('No .stl or .obj file found among the dropped files.');
        return;
      }
      dispatchWorkflow({ type: 'MODEL_LOADED' });
      markProjectCreated('import');
      // See handleSelectSample above -- already on 'import', which now
      // shows the orientation section once hasModel is true.
    } catch (err) {
      setImportWarning(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const handleImageSelected = async (file: File): Promise<void> => {
    setImportWarning(null);
    try {
      const decoded = await decodeImageFile(file, Number(state.reliefSettings.outputResolutionPx));
      setGeometry(null);
      setImageRaster(decoded);
      setImagePreviewUrl(URL.createObjectURL(file));
      dispatch({ type: 'SET_SOURCE', sourceKind: 'image-file', filename: file.name });
      dispatch({ type: 'SET_COLOR_MODE', mode: 'source-material' });
      dispatch({
        type: 'SET_PATTERN_DIMENSIONS',
        dimensions: {
          widthCm: 20,
          heightCm: Math.max(1, Math.round((20 * decoded.height * 10) / decoded.width) / 10),
          lockAspect: true,
        },
      });
      dispatchWorkflow({ type: 'MODEL_LOADED' });
      dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'workspace' });
      markProjectCreated('import');
    } catch (err) {
      setImportWarning(err instanceof Error ? err.message : 'Could not import this image.');
    }
  };

  // EXP-012 ("One-click pattern recipes"): applies a recipe's shape
  // (levels/intensity/smoothingStrength), detail (minRegionPreset) and
  // palette settings in one click, then jumps straight to the Export step
  // -- see ImportOrientSection's "Start from a recipe" cards. Builds the
  // palette's swatches directly at `recipe.reliefSettings.levels` length
  // (rather than dispatching SET_COLOR_MODE and waiting for the next
  // relief regeneration to resize them) because the two need to be applied
  // together in the same tick, before the maker ever sees a mismatched
  // intermediate state. Does not touch `sourceKind`/mark a new project --
  // a recipe presets an already-imported model's settings, it doesn't
  // replace the import itself.
  const handleApplyRecipe = useCallback((recipe: PatternRecipe): void => {
    const palette = getPaletteById(recipe.paletteId);
    if (!palette) return;
    dispatch({ type: 'SET_RELIEF_SETTINGS', settings: recipe.reliefSettings });
    dispatch({ type: 'SET_COLOR_MODE', mode: 'by-height' });
    const placeholderSwatches: ColorSwatch[] = Array.from(
      { length: recipe.reliefSettings.levels },
      (_, i) => ({ index: i, color: DEFAULT_SINGLE_COLOR, yarnName: `Yarn ${i + 1}` }),
    );
    dispatch({
      type: 'APPLY_COLOR_STORY',
      paletteId: palette.id,
      swatches: applyPaletteToSwatches(placeholderSwatches, palette),
    });
    setRecipeJumpToExport(true);
    dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'workspace' });
  }, []);

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
      needleGeometry: state.needleGeometry,
      patternDimensions: state.patternDimensions,
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
    [
      state.reliefSettings,
      state.colorMode,
      state.paletteSize,
      state.needleGeometry,
      state.patternDimensions,
    ],
  );

  useLiveRelief({
    hasModel: workflow.hasModel && state.sourceKind !== 'image-file',
    reliefSettings: state.reliefSettings,
    rotationDeg: state.modelRotationDeg,
    viewNonce,
    needleGeometry: state.needleGeometry,
    // Passed by reference, not reconstructed inline -- useLiveRelief's
    // effect dependency array compares this by reference, and
    // state.patternDimensions is already a stable object that only changes
    // identity on an actual SET_PATTERN_DIMENSIONS dispatch (see
    // appState.ts's reducer). A freshly-built `{widthCm, heightCm}`
    // literal here would change identity on every render and defeat that
    // comparison, re-debouncing on every unrelated re-render.
    patternDimensions: state.patternDimensions,
    captureColor: state.colorMode === 'source-material',
    capture: captureFromViewport,
    buildProcessArgs,
    process,
    onStart: () => dispatch({ type: 'PROCESSING_STARTED' }),
    onSuccess: (result, capturedWidth, capturedHeight) => {
      dispatch({
        type: 'PROCESSING_SUCCEEDED',
        result: {
          width: capturedWidth,
          height: capturedHeight,
          heightIndex: result.heightIndex,
          colorIndex: result.colorIndex ?? new Int16Array(result.heightIndex.length).fill(0),
          levels: result.levels,
        },
      });
      markPatternCompletedIfFirst();
    },
    onError: (message) => dispatch({ type: 'PROCESSING_FAILED', message }),
  });

  useEffect(() => {
    const generation = ++imageProcessGeneration.current;
    if (state.sourceKind !== 'image-file' || !imageRaster) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'PROCESSING_STARTED' });
      void processImage({
        rgba: imageRaster.rgba,
        width: imageRaster.width,
        height: imageRaster.height,
        settings: {
          paletteSize: state.paletteSize,
          detail: state.reliefSettings.minRegionPreset,
          smoothingStrength: state.reliefSettings.smoothingStrength,
          edgePreservation: state.reliefSettings.edgePreservation,
          seed: state.reliefSettings.seed,
          needleGeometry: state.needleGeometry,
          patternDimensions: state.patternDimensions,
          preserveSmallDetails: state.imageDetailSettings.preserveSmallDetails,
        },
      })
        .then((result) => {
          if (generation !== imageProcessGeneration.current) return;
          dispatch({
            type: 'PROCESSING_SUCCEEDED',
            result: {
              width: imageRaster.width,
              height: imageRaster.height,
              heightIndex: result.heightIndex,
              colorIndex: result.colorIndex ?? new Int16Array(result.heightIndex.length).fill(0),
              levels: result.levels,
            },
          });
          if (result.palette && result.palette.length > 0) {
            const detected = result.palette.map((color, index) => ({
              index,
              color,
              yarnName: `Image color ${index + 1}`,
            }));
            // Re-simplifying an image (any settings change re-runs this
            // effect) recomputes the auto-detected palette from scratch --
            // if a color-story palette is active, reapply it to the fresh
            // swatch list instead of reverting to the auto-detected colors,
            // so the chosen scheme survives routine regeneration.
            const activeStory = colorStoryIdRef.current
              ? getPaletteById(colorStoryIdRef.current)
              : undefined;
            if (activeStory) {
              dispatch({
                type: 'APPLY_COLOR_STORY',
                paletteId: activeStory.id,
                swatches: applyPaletteToSwatches(detected, activeStory),
              });
            } else {
              dispatch({ type: 'SET_SWATCHES', swatches: detected });
            }
          }
          markPatternCompletedIfFirst();
        })
        .catch((err: unknown) => {
          if (generation !== imageProcessGeneration.current) return;
          dispatch({
            type: 'PROCESSING_FAILED',
            message: err instanceof Error ? err.message : 'Image processing failed.',
          });
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    imageRaster,
    processImage,
    state.sourceKind,
    state.paletteSize,
    state.reliefSettings.minRegionPreset,
    state.reliefSettings.smoothingStrength,
    state.reliefSettings.edgePreservation,
    state.reliefSettings.seed,
    state.needleGeometry,
    state.patternDimensions,
    state.imageDetailSettings.preserveSmallDetails,
    markPatternCompletedIfFirst,
  ]);

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

  // Usability fix (docs/DECISIONS.md, follow-up to "move the Import 3D
  // orient viewport above the fold"): the label shown in ImportStage's
  // collapsed-picker summary once a model is loaded. Reuses the same
  // sourceKind/sampleId/sourceFilename fields SET_SOURCE already writes
  // (see handleSelectSample/handleFilesSelected above) rather than adding a
  // new piece of state just to describe what's loaded.
  const loadedModelLabel = useMemo(() => {
    if (state.sourceKind === 'built-in-sample') {
      return (state.sampleId && getSampleById(state.sampleId)?.name) ?? 'sample model';
    }
    if (state.sourceKind === 'user-file') {
      return state.sourceFilename;
    }
    if (state.sourceKind === 'image-file') return state.sourceFilename;
    return null;
  }, [state.sourceKind, state.sampleId, state.sourceFilename]);

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
              kind:
                state.sourceKind === 'image-file'
                  ? ('image-file' as const)
                  : ('user-file' as const),
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
      needleGeometry: state.needleGeometry,
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
    dispatch({
      type: 'SET_IMAGE_DETAIL_SETTINGS',
      settings: project.imageDetailSettings ?? { preserveSmallDetails: true },
    });
    // Iteration 04 schema decision: old (pre-Iteration-04) project files
    // never have `needleGeometry` -- default explicitly to "not set" rather
    // than trusting `??` alone. See docs/ITERATION_04_PLAN.md §7.
    dispatch({
      type: 'SET_NEEDLE_GEOMETRY',
      geometry: project.needleGeometry ?? { diameterMm: 0, throwMm: 0 },
    });
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
      <div
        className={
          workflow.currentStage === 'workspace' ? 'app-shell app-shell--workspace' : 'app-shell'
        }
      >
        <header className="app-header">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>{APP_TAGLINE}</p>
          </div>
          <span className="app-version">v{APP_VERSION}</span>
        </header>
        {/* Ambient "current model" indicator (Workspace two-column
            redesign), replacing the former StageNav sidebar. Deliberately
            not rendered on Import -- there's nothing to "change" while
            you're already on the Import stage picking a model; the
            existing ImportOrientSection "Continue to Workspace" button
            (unchanged, out of scope) remains the only forward navigation.
            See docs/DECISIONS.md. */}
        {workflow.currentStage === 'workspace' && (
          <ModelBar
            modelLabel={loadedModelLabel}
            onChangeModel={() => dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'import' })}
          />
        )}
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
                onImageSelected={(file) => void handleImageSelected(file)}
                hasModel={workflow.hasModel}
                loadedModelLabel={loadedModelLabel}
              />
              {importWarning && (
                <p role="alert" className="warning-banner" style={{ margin: '0 24px' }}>
                  {importWarning}
                </p>
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
              own `SimulationPanel` copy -- see docs/DECISIONS.md.

              Usability fix #2 (docs/DECISIONS.md, e2e/orient-persistence.spec.ts):
              this block must render *before* `ImportOrientSection` below --
              a real DOM reorder, not a CSS `order` trick, so DOM/visual/tab
              order stay in agreement -- so a user can't reach "Create my
              pattern" without the viewport having already scrolled into
              view first. */}
          {(workflow.currentStage === 'import' || workflow.currentStage === 'workspace') &&
            workflow.hasModel &&
            state.sourceKind !== 'image-file' && (
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
                  onViewChange={onViewChange}
                  showControls={workflow.currentStage === 'import'}
                />
              </div>
            )}

          {workflow.currentStage === 'import' &&
            workflow.hasModel &&
            state.sourceKind !== 'image-file' && (
              <ImportOrientSection
                onContinue={() => dispatchWorkflow({ type: 'GO_TO_STAGE', stage: 'workspace' })}
                showPreviewExpectations={previewExpectationsEnabled}
                recipes={PATTERN_RECIPES}
                onApplyRecipe={handleApplyRecipe}
              />
            )}

          {workflow.currentStage === 'workspace' && (
            <Workspace
              isImageSource={state.sourceKind === 'image-file'}
              sourceImageUrl={imagePreviewUrl}
              moveYarnColorsEarlier={moveYarnColorsEarlier}
              expressLane={expressLane}
              {...(recipeJumpToExport ? { initialEditorStep: 'export' as const } : {})}
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
                  type: 'APPLY_COLOR_STORY',
                  paletteId: palette.id,
                  swatches: applyPaletteToSwatches(state.swatches, palette),
                });
              }}
              undoPaletteName={
                state.colorStoryUndo
                  ? (getPaletteById(state.colorStoryUndo.paletteId)?.name ?? null)
                  : null
              }
              onUndoPalette={() => dispatch({ type: 'UNDO_COLOR_STORY' })}
              canResetColors={state.originalSwatches !== null}
              onResetColors={() => dispatch({ type: 'RESET_TO_DEFAULT_COLORS' })}
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
              needleGeometry={state.needleGeometry}
              onNeedleGeometryChange={(patch) =>
                dispatch({ type: 'SET_NEEDLE_GEOMETRY', geometry: patch })
              }
              imageDetailSettings={state.imageDetailSettings}
              onImageDetailSettingsChange={(patch) =>
                dispatch({ type: 'SET_IMAGE_DETAIL_SETTINGS', settings: patch })
              }
              processing={state.processing}
              processingError={state.processingError}
              showFirstProjectGuide={showFirstProjectGuide}
              onDismissFirstProjectGuide={dismissFirstProjectGuide}
            />
          )}
        </main>
        <PrivacyControl />
      </div>
    </ErrorBoundary>
  );
}

function hexToRgb(hex: string): RgbColor {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
