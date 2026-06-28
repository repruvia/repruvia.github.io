import { useState } from "react";
import { Crop, Film } from "lucide-react";
import { RecordingsLibrary } from "@/components/organisms/RecordingsLibrary";
import { SnapshotsLibrary } from "@/components/organisms/SnapshotsLibrary";
import { cn } from "@/lib/utils";
import type { RecordingItem } from "@/hooks/useRecordings";
import type { SnapshotItem } from "@/hooks/useSnapshots";

type Tab = "recordings" | "snapshots";

const TAB_KEY = "repruvia.libraryTab";

function readStoredTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "snapshots" ? "snapshots" : "recordings";
  } catch {
    return "recordings";
  }
}

interface LibraryTabsProps {
  recordings: RecordingItem[];
  onDeleteRecording: (id: string) => void;
  snapshots: SnapshotItem[];
  onDeleteSnapshot: (id: string) => void;
}

/** Unified library: a segmented toggle switching between recordings and snapshots. */
export function LibraryTabs({
  recordings,
  onDeleteRecording,
  snapshots,
  onDeleteSnapshot,
}: LibraryTabsProps) {
  const [tab, setTabState] = useState<Tab>(readStoredTab);

  // Persist the selection so the last-used tab is restored on reload.
  const setTab = (next: Tab) => {
    setTabState(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // localStorage unavailable — selection just won't persist.
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Film; count: number }[] = [
    { id: "recordings", label: "Recordings", icon: Film, count: recordings.length },
    { id: "snapshots", label: "Snapshots", icon: Crop, count: snapshots.length },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-1 rounded-lg border bg-card p-1">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs tabular-nums",
                tab === id ? "bg-primary/20" : "bg-muted text-muted-foreground",
              )}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab === "recordings" ? (
        <RecordingsLibrary recordings={recordings} onDelete={onDeleteRecording} showHeading={false} />
      ) : (
        <SnapshotsLibrary snapshots={snapshots} onDelete={onDeleteSnapshot} showHeading={false} />
      )}
    </section>
  );
}
