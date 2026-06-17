import { relativeTime, type NetworkFailure } from "@repruvia/shared";
import { Wifi } from "lucide-react";

interface NetworkFailuresListProps {
  failures: NetworkFailure[];
  startedAt: number;
}

export function NetworkFailuresList({ failures, startedAt }: NetworkFailuresListProps) {
  if (failures.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No network failures were captured in this session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {failures.map((failure) => (
        <div
          key={failure.id}
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5"
        >
          <Wifi className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {relativeTime(failure.timestamp, startedAt)} · {failure.status}
            </span>
            <p className="font-mono text-xs break-words whitespace-pre-wrap text-destructive">
              {failure.method} {failure.url}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
