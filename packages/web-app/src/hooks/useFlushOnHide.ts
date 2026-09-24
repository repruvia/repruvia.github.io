import { useEffect } from "react";

/**
 * Run `flush` when the tab is hidden or closed, and when the caller unmounts, so
 * a debounced save never loses the last edit.
 */
export function useFlushOnHide(flush: () => void): void {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
  }, [flush]);
}
