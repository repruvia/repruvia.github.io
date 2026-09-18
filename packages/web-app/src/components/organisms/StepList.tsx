import type { ConsoleEntry, NetworkFailure } from "@repruvia/shared";
import type { ReportEditor } from "@/hooks/useReportEditor";
import { StepCard } from "./StepCard";

// Shared empty lists keep memoized StepCards from re-rendering on a fresh `[]`.
const NO_CONSOLE: ConsoleEntry[] = [];
const NO_NETWORK: NetworkFailure[] = [];

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
          console={consoleByStep.get(step.id) ?? NO_CONSOLE}
          network={networkByStep.get(step.id) ?? NO_NETWORK}
          isFirst={i === 0}
          isLast={i === session.steps.length - 1}
          onEdit={actions.editStep}
          onDelete={actions.deleteStep}
          onMove={actions.moveStep}
        />
      ))}
    </div>
  );
}
