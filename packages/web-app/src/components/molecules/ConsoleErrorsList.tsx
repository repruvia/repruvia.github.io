import { relativeTime, type ConsoleEntry } from "@repruvia/shared";
import { AlertTriangle } from "lucide-react";

interface ConsoleErrorsListProps {
  entries: ConsoleEntry[];
  startedAt: number;
}

export function ConsoleErrorsList({ entries, startedAt }: ConsoleErrorsListProps) {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No console errors were captured in this session.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {relativeTime(entry.timestamp, startedAt)} · {entry.level}
            </span>
            <p className="font-mono text-xs break-words whitespace-pre-wrap text-destructive">
              {entry.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
