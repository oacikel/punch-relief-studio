/**
 * Workflow-stage state as a plain reducer (framework-light, unit testable)
 * per CLAUDE.md. React components dispatch actions; they never encode
 * navigation rules inline. Settings are preserved across stage changes --
 * navigation never resets prior work.
 *
 * Two visible stages (down from five as of Iteration 03's combined-
 * workspace change -- see docs/ITERATION_03_PLAN.md #13). 'relief',
 * 'height', 'color', and 'preview' are no longer distinct stages: their
 * content is now one persistent 'workspace' stage (a control rail +
 * live-updating preview, modeled on 3D-print slicer software) rendered by
 * `src/components/workspace/Workspace.tsx`, replacing the old
 * page-by-page wizard. 'import' is unchanged -- a model is a real
 * prerequisite for everything else, so it stays a separate first step. No
 * alias/migration is needed for the old stage names: stage is plain
 * in-memory state, never persisted to localStorage, the project JSON
 * schema, or a URL (verified in docs/ITERATION_02_PLAN.md §2.2), so no real
 * data path can ever produce the old values.
 */

export const WORKFLOW_STAGES = ['import', 'workspace'] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export interface WorkflowState {
  currentStage: WorkflowStage;
  /** Stages the user has reached at least once -- used to allow jumping
   * backward/forward without losing settings, while still gating stages
   * that require a completed import. */
  reachedStages: Set<WorkflowStage>;
  hasModel: boolean;
}

export type WorkflowAction =
  | { type: 'MODEL_LOADED' }
  | { type: 'GO_TO_STAGE'; stage: WorkflowStage }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'RESET' };

export function initialWorkflowState(): WorkflowState {
  return { currentStage: 'import', reachedStages: new Set(['import']), hasModel: false };
}

export function workflowReducer(state: WorkflowState, action: WorkflowAction): WorkflowState {
  switch (action.type) {
    case 'MODEL_LOADED':
      return { ...state, hasModel: true };
    case 'GO_TO_STAGE': {
      if (action.stage !== 'import' && !state.hasModel) return state; // gated
      const reached = new Set(state.reachedStages);
      reached.add(action.stage);
      return { ...state, currentStage: action.stage, reachedStages: reached };
    }
    case 'NEXT': {
      const idx = WORKFLOW_STAGES.indexOf(state.currentStage);
      const next = WORKFLOW_STAGES[Math.min(WORKFLOW_STAGES.length - 1, idx + 1)];
      if (!next) return state;
      return workflowReducer(state, { type: 'GO_TO_STAGE', stage: next });
    }
    case 'BACK': {
      const idx = WORKFLOW_STAGES.indexOf(state.currentStage);
      const prev = WORKFLOW_STAGES[Math.max(0, idx - 1)];
      if (!prev) return state;
      return workflowReducer(state, { type: 'GO_TO_STAGE', stage: prev });
    }
    case 'RESET':
      return initialWorkflowState();
    default:
      return state;
  }
}
