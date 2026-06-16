import type { ConsoleEntry, NetworkFailure } from "@repruvia/shared";
import { AlertTriangle, Wifi } from "lucide-react";

interface StepErrorsProps {
  console: ConsoleEntry[];
  network: NetworkFailure[];
}

export function StepErrors({ console, network }: StepErrorsProps) {
  if (console.length === 0 && network.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
      {console.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2 text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="font-mono break-all">
            {entry.level.toUpperCase()}: {entry.message}
          </span>
        </div>
      ))}
      {network.map((failure) => (
        <div key={failure.id} className="flex items-start gap-2 text-destructive">
          <Wifi className="mt-0.5 size-3.5 shrink-0" />
          <span className="font-mono break-all">
            {failure.method} {failure.url} → {failure.status}
          </span>
        </div>
      ))}
    </div>
  );
}
