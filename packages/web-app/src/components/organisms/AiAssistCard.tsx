import type { Report } from "@repruvia/shared";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAiAnalysis } from "@/hooks/useAiAnalysis";
import { loadSettings } from "@/lib/settings";

/**
 * One-click AI analysis. Runs a small LLM entirely in the browser (WebGPU, no
 * server, no API key) and fills in the title, severity, description, and an
 * improved phrasing for every step. Presentational: behaviour lives in
 * `useAiAnalysis`.
 */
export function AiAssistCard({ report }: { report: Report | null }) {
  const { status, progress, progressText, applied, error, analyze } = useAiAnalysis(report);

  // Hooks run unconditionally above; the card is hidden when AI is turned off in
  // Settings, or while WebGPU support is still being detected.
  if (!loadSettings().aiEnabled || status === "checking") return null;

  const busy = status === "loading" || status === "analyzing";
  const percent = Math.round(progress * 100);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-primary" />
          Refine with AI
          <span className="font-normal text-muted-foreground">· runs in your browser</span>
        </CardTitle>
        {status !== "unsupported" && (
          <Button size="sm" onClick={analyze} disabled={busy || !report}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {busy ? (status === "loading" ? "Loading model…" : "Refining…") : "Refine with AI"}
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {status === "unsupported" && (
          <p className="text-sm text-muted-foreground">
            Your browser doesn&apos;t support WebGPU, so on-device AI isn&apos;t available. Try the
            latest Chrome or Edge on desktop.
          </p>
        )}

        {status === "idle" && (
          <p className="text-sm text-muted-foreground">
            One click generates a title, picks a severity, writes a description, and rewrites every
            step from the captured evidence. The first run downloads a ~0.9&nbsp;GB model (cached
            after). Nothing leaves your device.
          </p>
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-1.5">
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">{progressText || `Loading model… ${percent}%`}</p>
          </div>
        )}

        {status === "analyzing" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Reading the session and refining the report…
          </p>
        )}

        {status === "done" && applied && (
          <p className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="size-4" />
            Updated{" "}
            {[
              applied.title && "title",
              applied.severity && "severity",
              applied.description && "description",
              applied.steps > 0 && `${applied.steps} step${applied.steps === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        )}

        {status === "error" && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error ?? "Something went wrong during analysis."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
