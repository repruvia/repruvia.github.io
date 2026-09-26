import type { ReactNode } from "react";
import { ExternalLink, Loader2, LogIn, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { JiraIcon, LinearIcon } from "@/components/atoms/BrandIcons";
import type { CloudTicket } from "@/lib/cloud/ticketSync";
import type { TicketHistoryStatus } from "@/hooks/useTicketHistory";

interface AccountSectionProps {
  status: "loading" | "signedIn" | "signedOut";
  displayName: string | null;
  email: string | null;
  tickets: CloudTicket[];
  historyStatus: TicketHistoryStatus;
  historyError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRefresh: () => void;
  /** Editable reporter name/email, shown only while signed out. */
  reporterFields: ReactNode;
}

/** Sign-in state, what syncs, and the account's ticket history. */
export function AccountSection({
  status,
  displayName,
  email,
  tickets,
  historyStatus,
  historyError,
  onSignIn,
  onSignOut,
  onRefresh,
  reporterFields,
}: AccountSectionProps) {
  if (status === "loading") {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }

  if (status === "signedOut") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm text-muted-foreground">
            Sign in to report as your Google account, sync your preferences across devices, and
            keep a history of the tickets you raise. Your recordings, screenshots, and API keys
            always stay on this device.
          </p>
          <Button onClick={onSignIn}>
            <LogIn /> Sign in with Google
          </Button>
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Or report without an account</h3>
          {reporterFields}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName || "Signed in"}</p>
          {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onSignOut}>
          <LogOut /> Sign out
        </Button>
      </div>

      <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        Your reports are signed with this name and email. Your Jira site and AI choices sync to
        your account. Your API keys, Linear and Jira tokens, recordings, and screenshots never
        leave this device.
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Ticket history</h3>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh ticket history"
            onClick={onRefresh}
            disabled={historyStatus === "loading"}
          >
            <RefreshCw className={historyStatus === "loading" ? "animate-spin" : undefined} />
          </Button>
        </div>

        {historyStatus === "error" && (
          <div className="flex flex-col items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <p>{historyError || "Ticket history isn't available right now."}</p>
            <Button variant="ghost" size="sm" className="h-auto p-0 text-destructive" onClick={onRefresh}>
              Try again
            </Button>
          </div>
        )}

        {historyStatus === "ready" && tickets.length === 0 && (
          <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Tickets you raise while signed in will show up here.
          </p>
        )}

        {tickets.length > 0 && (
          <ul className="flex flex-col divide-y rounded-md border">
            {tickets.map((ticket) => (
              <li key={ticket.sourceId} className="flex items-center gap-3 px-3 py-2.5">
                {ticket.provider === "linear" ? (
                  <LinearIcon className="size-4 shrink-0" />
                ) : (
                  <JiraIcon className="size-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ticket.title || ticket.identifier}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {ticket.identifier} · {new Date(ticket.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {ticket.sourceKind === "snapshot" ? "Snapshot" : "Recording"}
                </Badge>
                <Button asChild variant="ghost" size="icon" aria-label={`Open ${ticket.identifier}`}>
                  <a href={ticket.url} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
