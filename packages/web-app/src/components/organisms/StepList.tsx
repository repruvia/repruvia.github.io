import type { ReportEditor } from "@/hooks/useReportEditor";
import { StepCard } from "./StepCard";

/** Renders the ordered list of steps, wiring each card to the editor actions. */
export function StepList({ editor }: { editor: ReportEditor }) {
  const { session, consoleByStep, networkByStep, actions } = editor;
  if (!session) return null;

  if (session.steps.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No interactions were captured in this session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {session.steps.map((step, i) => (
        <StepCard
          key={step.id}
          step={step}
          console={consoleByStep.get(step.id) ?? []}
          network={networkByStep.get(step.id) ?? []}
          isFirst={i === 0}
          isLast={i === session.steps.length - 1}
          onEdit={(description) => actions.editStep(step.id, description)}
          onDelete={() => actions.deleteStep(step.id)}
          onMove={(direction) => actions.moveStep(step.id, direction)}
        />
      ))}
    </div>
  );
}
