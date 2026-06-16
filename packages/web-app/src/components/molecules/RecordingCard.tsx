import { useNavigate } from "react-router-dom";
import { SESSION_QUERY_PARAM } from "@repruvia/shared";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Copy,
  MousePointerClick,
  MoreVertical,
  SquareArrowOutUpRight,
  Trash2,
  Wifi,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { describeUrl, timeAgo } from "@/lib/formatTime";
import type { RecordingItem } from "@/hooks/useRecordings";

interface RecordingCardProps {
  recording: RecordingItem;
  onDelete: (id: string) => void;
}

/** Lightweight plain-text snippet from a Markdown description. */
function snippet(markdown: string): string {
  return markdown.replace(/[#*`_>[\]]/g, "").replace(/\s+/g, " ").trim();
}

export function RecordingCard({ recording, onDelete }: RecordingCardProps) {
  const navigate = useNavigate();
  const href = `/?${SESSION_QUERY_PARAM}=${encodeURIComponent(recording.id)}`;
  const url = describeUrl(recording.tabUrl);
  const heading = recording.title || url;
  const open = () => navigate(href);

  return (
    <Card className="group gap-0 py-0 transition-colors hover:border-primary/40">
      <CardContent className="flex items-start gap-3 px-4 py-3.5">
        <button type="button" onClick={open} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
          <h3 className="truncate text-base font-semibold tracking-tight">{heading}</h3>

          {recording.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {snippet(recording.description)}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate font-mono">{url}</span>
            <Dot />
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {timeAgo(recording.startedAt)}
            </span>
            <Dot />
            <span className="flex items-center gap-1">
              <MousePointerClick className="size-3.5" /> {recording.stepCount} steps
            </span>
            {recording.consoleErrorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertTriangle className="size-3.5" /> {recording.consoleErrorCount}
              </span>
            )}
            {recording.networkFailureCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <Wifi className="size-3.5" /> {recording.networkFailureCount}
              </span>
            )}
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Recording actions"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [&_svg]:size-4"
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={open}>
              <SquareArrowOutUpRight /> Open report
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard?.writeText(`${window.location.origin}${href}`);
                toast.success("Link copied");
              }}
            >
              <Copy /> Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(recording.id)}>
              <Trash2 /> Delete recording
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function Dot() {
  return <span className="text-muted-foreground/40">·</span>;
}
