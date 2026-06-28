import { useCallback, useEffect, useState } from "react";
import type { SnapshotSummary } from "@repruvia/shared";
import { ExtensionUnavailableError, extensionBridge } from "@/lib/extensionBridge";
import { deletePersistedSnapshot, loadAllSnapshotMeta } from "@/lib/snapshotPersistence";
import { deleteCreatedTicket } from "@/lib/ticketPersistence";

export type SnapshotsStatus = "checking" | "unavailable" | "ready" | "error";

/** A snapshot summary enriched with the tester's saved title. */
export interface SnapshotItem extends SnapshotSummary {
  title?: string;
}

interface SnapshotsState {
  status: SnapshotsStatus;
  snapshots: SnapshotItem[];
  error: string | null;
}

/** Loads the saved snip snapshots from the extension (mirrors `useRecordings`). */
export function useSnapshots() {
  const [state, setState] = useState<SnapshotsState>({
    status: "checking",
    snapshots: [],
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const [summaries, metaById] = await Promise.all([
        extensionBridge.listSnapshots(),
        loadAllSnapshotMeta(),
      ]);
      const snapshots: SnapshotItem[] = summaries
        .map((s) => ({ ...s, title: metaById.get(s.id)?.title?.trim() || undefined }))
        .sort((a, b) => b.createdAt - a.createdAt);
      setState({ status: "ready", snapshots, error: null });
    } catch (error) {
      if (error instanceof ExtensionUnavailableError) {
        setState({ status: "unavailable", snapshots: [], error: null });
      } else {
        setState({ status: "error", snapshots: [], error: (error as Error).message });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [refresh]);

  const remove = useCallback(
    async (snapshotId: string) => {
      setState((s) => ({ ...s, snapshots: s.snapshots.filter((r) => r.id !== snapshotId) }));
      try {
        await extensionBridge.deleteSnapshot(snapshotId);
        await deletePersistedSnapshot(snapshotId);
        await deleteCreatedTicket(snapshotId);
      } finally {
        void refresh();
      }
    },
    [refresh],
  );

  return { ...state, refresh, remove };
}
