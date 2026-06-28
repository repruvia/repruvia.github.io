import { Film } from "lucide-react";
import { RecordingCard } from "@/components/molecules/RecordingCard";
import type { RecordingItem } from "@/hooks/useRecordings";

interface RecordingsLibraryProps {
  recordings: RecordingItem[];
  onDelete: (id: string) => void;
  showHeading?: boolean;
}

/** Lists saved recordings, or an empty state prompting the user to record one. */
export function RecordingsLibrary({ recordings, onDelete, showHeading = true }: RecordingsLibraryProps) {
  return (
    <section className="flex flex-col gap-3">
      {showHeading && (
        <h2 className="text-sm font-semibold text-muted-foreground">
          Your recordings ({recordings.length})
        </h2>
      )}

      {recordings.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Film className="size-7 text-muted-foreground" />
          <p className="font-medium">No recordings yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Open the page you want to test, click the Repruvia toolbar icon, and start recording.
            Your sessions show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recordings.map((recording) => (
            <RecordingCard key={recording.id} recording={recording} onDelete={onDelete} />
          ))}
        </div>
      )}
    </section>
  );
}
