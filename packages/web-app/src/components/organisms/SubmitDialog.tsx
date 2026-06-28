import { useEffect, useState } from "react";
import type { Report } from "@repruvia/shared";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTicketSubmission } from "@/hooks/useTicketSubmission";
import type { ProviderId } from "@/lib/integrations/providerRegistry";

interface SubmitDialogProps {
  providerId: ProviderId | null;
  report: Report | null;
  onClose: () => void;
  onCreated?: (ticket: { provider: ProviderId; identifier: string; url: string }) => void;
}

/** Drives connect → pick container → submit. Pure UI over `useTicketSubmission`; knows nothing about Linear vs Jira. */
export function SubmitDialog({ providerId, report, onClose, onCreated }: SubmitDialogProps) {
  const { state, providers, connect, submit, reset } = useTicketSubmission(report);
  const [containerId, setContainerId] = useState<string>("");
  const [includeImages, setIncludeImages] = useState(true);

  const open = providerId !== null;
  const provider = providerId ? providers[providerId] : null;
  const hasScreenshots = report?.session.steps.some((s) => s.screenshot) ?? false;

  // Surface a successful creation to the parent (once per result) so it can be
  // persisted and the action bar can switch to "View issue".
  useEffect(() => {
    if (state.phase === "done" && state.result && providerId) {
      onCreated?.({ provider: providerId, ...state.result });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  useEffect(() => {
    if (open && providerId) {
      setContainerId("");
      setIncludeImages(true);
      void connect(providerId);
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providerId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit to {provider?.displayName}</DialogTitle>
          <DialogDescription>
            Create an issue with the report body, screenshots, and recording.
          </DialogDescription>
        </DialogHeader>

        {state.phase === "connecting" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Connecting…
          </p>
        )}

        {state.phase === "error" && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        {(state.phase === "ready" || state.phase === "submitting") && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="container">Destination</Label>
            <Select value={containerId} onValueChange={setContainerId}>
              <SelectTrigger id="container" className="w-full">
                <SelectValue placeholder="Select a team / project" />
              </SelectTrigger>
              <SelectContent>
                {state.containers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasScreenshots && (
              <div className="mt-2 flex items-center justify-between gap-4 rounded-md border p-3">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="include-images">Include screenshots</Label>
                  <span className="text-xs text-muted-foreground">
                    Embed step screenshots inline in the issue.
                  </span>
                </div>
                <Switch
                  id="include-images"
                  checked={includeImages}
                  onCheckedChange={setIncludeImages}
                  disabled={state.phase === "submitting"}
                />
              </div>
            )}
          </div>
        )}

        {state.phase === "done" && state.result && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-10 text-primary" />
            <p className="font-medium">Created {state.result.identifier}</p>
            <Button asChild variant="outline" size="sm">
              <a href={state.result.url} target="_blank" rel="noreferrer">
                Open issue <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        )}

        <DialogFooter>
          {state.phase === "done" ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={!containerId || state.phase !== "ready"}
                onClick={() => providerId && submit(providerId, containerId, includeImages)}
              >
                {state.phase === "submitting" && <Loader2 className="size-4 animate-spin" />}
                {state.phase === "submitting"
                  ? `Uploading ${Math.round(state.progress * 100)}%`
                  : "Create issue"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
