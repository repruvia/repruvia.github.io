import { Crop } from "lucide-react";
import { SnapshotCard } from "@/components/molecules/SnapshotCard";
import type { SnapshotItem } from "@/hooks/useSnapshots";

interface SnapshotsLibraryProps {
  snapshots: SnapshotItem[];
  onDelete: (id: string) => void;
  showHeading?: boolean;
}

/** Lists saved snip snapshots, or an empty state prompting the user to take one. */
export function SnapshotsLibrary({ snapshots, onDelete, showHeading = true }: SnapshotsLibraryProps) {
  return (
    <section className="flex flex-col gap-3">
      {showHeading && (
        <h2 className="text-sm font-semibold text-muted-foreground">
          Your snapshots ({snapshots.length})
        </h2>
      )}

      {snapshots.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Crop className="size-7 text-muted-foreground" />
          <p className="font-medium">No snapshots yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Click the Repruvia toolbar icon and choose <strong>Snip Screenshot</strong>, then drag
            to capture a region. It opens here for annotation.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {snapshots.map((snapshot) => (
            <SnapshotCard key={snapshot.id} snapshot={snapshot} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
