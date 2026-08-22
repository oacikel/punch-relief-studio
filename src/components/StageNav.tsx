import { WORKFLOW_STAGES, type WorkflowStage } from '@/state/workflow';

const LABELS: Record<WorkflowStage, string> = {
  import: '1. Import',
  workspace: '2. Workspace',
};

/** Short captions under each nav item, per the approved combined-workspace
 * mockup (docs/ITERATION_03_PLAN.md #13) -- explains what's inside
 * "Workspace" now that it's no longer several separately-titled pages. */
const CAPTIONS: Record<WorkflowStage, string> = {
  import: 'Load a model to work with.',
  workspace: 'Pile heights, punch detail, shape, yarn colors, export & print -- all live.',
};

interface Props {
  current: WorkflowStage;
  hasModel: boolean;
  onSelect: (stage: WorkflowStage) => void;
}

export function StageNav({ current, hasModel, onSelect }: Props): JSX.Element {
  return (
    <nav className="stage-nav" aria-label="Workflow steps">
      <ol>
        {WORKFLOW_STAGES.map((stage) => {
          const disabled = stage !== 'import' && !hasModel;
          // "Done" visual state: Import, once a model has loaded and it's
          // no longer the active stage (per the approved mockup). A CSS
          // class only -- the button's accessible name stays exactly
          // "1. Import" so this never shows up as a dynamic label change
          // to assistive tech.
          const done = stage === 'import' && hasModel && current !== stage;
          return (
            <li key={stage}>
              <button
                type="button"
                className={done ? 'done' : undefined}
                aria-current={current === stage ? 'step' : undefined}
                disabled={disabled}
                onClick={() => onSelect(stage)}
              >
                {LABELS[stage]}
              </button>
              <p className="stage-nav__caption">{CAPTIONS[stage]}</p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
