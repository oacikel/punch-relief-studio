import { describe, expect, it } from 'vitest';
import { initialWorkflowState, workflowReducer } from '../workflow';

describe('workflowReducer', () => {
  it('starts on the import stage with no model loaded', () => {
    const state = initialWorkflowState();
    expect(state.currentStage).toBe('import');
    expect(state.hasModel).toBe(false);
  });

  it('gates non-import stages until a model is loaded', () => {
    const state = initialWorkflowState();
    const next = workflowReducer(state, { type: 'GO_TO_STAGE', stage: 'workspace' });
    expect(next.currentStage).toBe('import'); // unchanged, gated
  });

  it('allows navigating to workspace once a model is loaded', () => {
    let state = initialWorkflowState();
    state = workflowReducer(state, { type: 'MODEL_LOADED' });
    state = workflowReducer(state, { type: 'GO_TO_STAGE', stage: 'workspace' });
    expect(state.currentStage).toBe('workspace');
  });

  it('NEXT/BACK move one stage at a time and clamp at the ends', () => {
    let state = initialWorkflowState();
    state = workflowReducer(state, { type: 'MODEL_LOADED' });
    state = workflowReducer(state, { type: 'BACK' }); // already at first stage
    expect(state.currentStage).toBe('import');
    state = workflowReducer(state, { type: 'NEXT' });
    expect(state.currentStage).toBe('workspace');
  });

  it('has exactly the two Iteration-03 stages, in order (no separate relief/height/color/preview stage)', () => {
    let state = initialWorkflowState();
    state = workflowReducer(state, { type: 'MODEL_LOADED' });
    state = workflowReducer(state, { type: 'GO_TO_STAGE', stage: 'workspace' });
    // clamps at the last stage -- if 'workspace' weren't the final stage,
    // NEXT would move past it.
    state = workflowReducer(state, { type: 'NEXT' });
    expect(state.currentStage).toBe('workspace');
  });

  it('does not lose reachedStages when moving backward and forward again', () => {
    let state = initialWorkflowState();
    state = workflowReducer(state, { type: 'MODEL_LOADED' });
    state = workflowReducer(state, { type: 'GO_TO_STAGE', stage: 'workspace' });
    state = workflowReducer(state, { type: 'GO_TO_STAGE', stage: 'import' });
    expect(state.reachedStages.has('workspace')).toBe(true);
  });

  it('RESET returns to the initial state', () => {
    let state = initialWorkflowState();
    state = workflowReducer(state, { type: 'MODEL_LOADED' });
    state = workflowReducer(state, { type: 'RESET' });
    expect(state.hasModel).toBe(false);
    expect(state.currentStage).toBe('import');
  });
});
