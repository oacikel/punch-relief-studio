/**
 * Workflow-stage state as a plain reducer (framework-light, unit testable)
 * per CLAUDE.md. React components dispatch actions; they never encode
 * navigation rules inline. Settings are preserved across stage changes --
 * navigation never resets prior work.
 */

export const WORKFLOW_STAGES = [
  'import',
  'orient',
  'relief',
  'height',
  'color',
  'preview',
  'export',
] as const;

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
