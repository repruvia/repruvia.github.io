import { relativeTime, type RepruviaSession } from "@repruvia/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function IssuesSummary({ session }: { session: RepruviaSession }) {
  const { consoleErrors, networkFailures, startedAt } = session;
  if (consoleErrors.length === 0 && networkFailures.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {consoleErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Console Errors ({consoleErrors.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {consoleErrors.map((entry) => (
              <div key={entry.id} className="text-xs">
                <span className="text-muted-foreground">
                  {relativeTime(entry.timestamp, startedAt)} · {entry.level.toUpperCase()}
                </span>
                <p className="font-mono break-all">{entry.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {networkFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Network Failures ({networkFailures.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {networkFailures.map((failure) => (
              <div key={failure.id} className="text-xs">
                <span className="text-muted-foreground">
                  {relativeTime(failure.timestamp, startedAt)} · {failure.status}
                </span>
                <p className="font-mono break-all">
                  {failure.method} {failure.url}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
