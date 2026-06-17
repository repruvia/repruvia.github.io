import {
  Chrome,
  Github,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/atoms/PageContainer";
import { RecordingsLibrary } from "@/components/organisms/RecordingsLibrary";
import { RecordingsSkeleton } from "@/components/molecules/RecordingsSkeleton";
import { useRecordings } from "@/hooks/useRecordings";
import { CHROME_WEBSTORE_URL } from "@/lib/links";

const FEATURES = [
  {
    icon: MousePointerClick,
    title: "Auto-captured steps",
    body: "Every click, input, and navigation becomes a numbered step with a screenshot — no manual logging, ever.",
    span: "md:col-span-2",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Stays in your browser. Input values are never recorded.",
    span: "",
  },
  {
    icon: Ticket,
    title: "One-click tickets",
    body: "Push to Linear or Jira, or export Markdown.",
    span: "",
  },
  {
    icon: Sparkles,
    title: "On-device AI",
    body: "Draft the title, severity, description, and every step with a model that runs entirely in your browser — no API key, no server.",
    span: "md:col-span-2",
  },
];

export function HomePage() {
  const { status, recordings, error, remove } = useRecordings();
  const installed = status === "ready";

  return (
    <PageContainer className="flex flex-col gap-12 py-12 sm:py-16">
      <section className="flex animate-in flex-col items-start gap-5 fade-in slide-in-from-bottom-3 duration-700">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          Capture · Reproduce · Report
        </span>

        <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Bug reports that
          <br />
          <span className="text-primary">write themselves.</span>
        </h1>

        <p className="max-w-xl text-lg text-muted-foreground">
          Record a session, reproduce the bug, and Repruvia assembles a step-by-step report —
          screenshots, console errors, network failures — ready to ship to Linear or Jira.
        </p>

        {!installed && status !== "checking" && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href={CHROME_WEBSTORE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              <Chrome className="size-4" /> Install the extension
            </a>
            <a
              href="https://github.com/leoAnimesh/repruvia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent"
            >
              <Github className="size-4" /> Star on GitHub
            </a>
          </div>
        )}
      </section>

      {status === "checking" && <RecordingsSkeleton />}

      {installed && (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
          <RecordingsLibrary recordings={recordings} onDelete={remove} />
        </div>
      )}

      {status === "error" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-center text-sm text-destructive">
          Couldn&apos;t reach the extension: {error}
        </p>
      )}

      {!installed && status !== "checking" && (
        <section className="grid auto-rows-fr gap-3 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body, span }, i) => (
            <Card
              key={title}
              style={{ animationDelay: `${150 + i * 90}ms`, animationFillMode: "backwards" }}
              className={`${span} animate-in fade-in slide-in-from-bottom-3 duration-700 transition-colors hover:border-primary/40`}
            >
              <CardContent className="flex h-full flex-col gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </PageContainer>
  );
}
