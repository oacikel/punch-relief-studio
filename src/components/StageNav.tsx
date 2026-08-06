import { WORKFLOW_STAGES, type WorkflowStage } from '@/state/workflow';

const LABELS: Record<WorkflowStage, string> = {
  import: '1. Import',
  orient: '2. Orient',
  relief: '3. Create relief',
  height: '4. Height levels',
  color: '5. Yarn colors',
  preview: '6. Preview',
  export: '7. Export',
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
          return (
            <li key={stage}>
              <button
                type="button"
                aria-current={current === stage ? 'step' : undefined}
                disabled={disabled}
                onClick={() => onSelect(stage)}
              >
                {LABELS[stage]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
