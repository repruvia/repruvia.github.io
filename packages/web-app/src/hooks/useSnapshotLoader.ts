import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { SNAPSHOT_QUERY_PARAM } from "@repruvia/shared";
import { useSnapshotStore } from "@/store/snapshotStore";
import { extensionBridge } from "@/lib/extensionBridge";
import { loadPersistedSnapshot } from "@/lib/snapshotPersistence";

/**
 * Read the `?snapshot=` param reactively via the router (see `useSessionId` for
 * why `useSearchParams`, not `window.location`).
 */
export function useSnapshotId(): string | null {
  const [params] = useSearchParams();
  return params.get(SNAPSHOT_QUERY_PARAM);
}

/** Loads the snapshot (image from the extension, annotations from local storage) into the store in parallel. */
export function useSnapshotLoader(snapshotId: string | null): void {
  const beginLoad = useSnapshotStore((s) => s.beginLoad);
  const setSnapshot = useSnapshotStore((s) => s.setSnapshot);
  const setError = useSnapshotStore((s) => s.setError);

  useEffect(() => {
    if (!snapshotId) return;
    let cancelled = false;

    beginLoad();
    Promise.all([
      extensionBridge.getSnapshot(snapshotId),
      loadPersistedSnapshot(snapshotId),
    ])
      .then(([snapshot, persisted]) => {
        if (cancelled) return;
        if (!snapshot) setError("Snapshot not found. It may have expired or been deleted.");
        else setSnapshot(snapshot, persisted);
      })
      .catch((error: Error) => {
        if (!cancelled) setError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [snapshotId, beginLoad, setSnapshot, setError]);
}
