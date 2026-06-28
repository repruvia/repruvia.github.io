import { useNavigate } from "react-router-dom";
import { SNAPSHOT_QUERY_PARAM } from "@repruvia/shared";
import { toast } from "sonner";
import {
  Clock,
  Copy,
  Crop,
  MoreVertical,
  SquareArrowOutUpRight,
  Trash2,
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
import type { SnapshotItem } from "@/hooks/useSnapshots";

interface SnapshotCardProps {
  snapshot: SnapshotItem;
  onDelete: (id: string) => void;
}

export function SnapshotCard({ snapshot, onDelete }: SnapshotCardProps) {
  const navigate = useNavigate();
  const href = `/?${SNAPSHOT_QUERY_PARAM}=${encodeURIComponent(snapshot.id)}`;
  const url = describeUrl(snapshot.tabUrl);
  const heading = snapshot.title || url;
  const open = () => navigate(href);

  return (
    <Card className="group gap-0 py-0 transition-colors hover:border-primary/40">
      <CardContent className="flex items-start gap-3 px-4 py-3.5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Crop className="size-4" />
        </span>

        <button type="button" onClick={open} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
          <h3 className="truncate text-base font-semibold tracking-tight">{heading}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate font-mono">{url}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> {timeAgo(snapshot.createdAt)}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="font-mono">
              {snapshot.width}×{snapshot.height}
            </span>
          </div>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Snapshot actions"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [&_svg]:size-4"
          >
            <MoreVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={open}>
              <SquareArrowOutUpRight /> Open editor
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
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(snapshot.id)}>
              <Trash2 /> Delete snapshot
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
