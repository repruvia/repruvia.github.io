import type { ReportEditor } from "@/hooks/useReportEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StepList } from "@/components/organisms/StepList";
import { ConsoleErrorsList } from "@/components/molecules/ConsoleErrorsList";
import { NetworkFailuresList } from "@/components/molecules/NetworkFailuresList";

/** Steps / Console errors / Network errors as a single tabbed surface. */
export function ReportTabs({ editor }: { editor: ReportEditor }) {
  const { session } = editor;
  if (!session) return null;

  const stepCount = session.steps.length;
  const consoleCount = session.consoleErrors.length;
  const networkCount = session.networkFailures.length;

  return (
    <Tabs defaultValue="steps" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="steps">
          Steps
          <CountBadge value={stepCount} />
        </TabsTrigger>
        <TabsTrigger value="console">
          Console Errors
          <CountBadge value={consoleCount} tone="error" />
        </TabsTrigger>
        <TabsTrigger value="network">
          Network Errors
          <CountBadge value={networkCount} tone="error" />
        </TabsTrigger>
      </TabsList>

      <TabsContent value="steps">
        <StepList editor={editor} />
      </TabsContent>
      <TabsContent value="console">
        <ConsoleErrorsList entries={session.consoleErrors} startedAt={session.startedAt} />
      </TabsContent>
      <TabsContent value="network">
        <NetworkFailuresList failures={session.networkFailures} startedAt={session.startedAt} />
      </TabsContent>
    </Tabs>
  );
}

function CountBadge({ value, tone }: { value: number; tone?: "error" }) {
  if (value === 0) return null;
  return (
    <Badge
      variant={tone === "error" ? "destructive" : "secondary"}
      className="h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums"
    >
      {value}
    </Badge>
  );
}
