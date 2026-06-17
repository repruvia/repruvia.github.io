import { useState } from "react";
import type { ConsoleEntry, NetworkFailure } from "@repruvia/shared";
import { AlertTriangle, Wifi } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface StepErrorsProps {
  console: ConsoleEntry[];
  network: NetworkFailure[];
}

export function StepErrors({ console, network }: StepErrorsProps) {
  const [open, setOpen] = useState(false);
  if (console.length === 0 && network.length === 0) return null;

  const total = console.length + network.length;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {console.length > 0 && (
          <ErrorTile
            icon={<AlertTriangle className="size-3.5" />}
            count={console.length}
            label={console.length === 1 ? "console error" : "console errors"}
            onClick={() => setOpen(true)}
          />
        )}
        {network.length > 0 && (
          <ErrorTile
            icon={<Wifi className="size-3.5" />}
            count={network.length}
            label={network.length === 1 ? "network failure" : "network failures"}
            onClick={() => setOpen(true)}
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Errors for this step</DialogTitle>
            <DialogDescription>
              {total} {total === 1 ? "issue" : "issues"} captured while this interaction was recorded.
            </DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {console.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span className="font-mono break-words whitespace-pre-wrap">
                  {entry.level.toUpperCase()}: {entry.message}
                </span>
              </div>
            ))}
            {network.map((failure) => (
              <div
                key={failure.id}
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
              >
                <Wifi className="mt-0.5 size-3.5 shrink-0" />
                <span className="font-mono break-words whitespace-pre-wrap">
                  {failure.method} {failure.url} → {failure.status}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ErrorTileProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  onClick: () => void;
}

function ErrorTile({ icon, count, label, onClick }: ErrorTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
    >
      {icon}
      <span className="font-mono">{count}</span>
      <span>{label}</span>
    </button>
  );
}
