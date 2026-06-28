import { isoFromMs, type Report, type RepruviaSession, type Snapshot, type Step } from "@repruvia/shared";

/** Best-effort URL path for the environment block. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/**
 * Adapt a snip snapshot into a minimal {@link Report} so it can reuse the report
 * pipeline (export, ticket submission, screenshot upload): the annotated image
 * becomes a single step's screenshot; title/description become the report meta.
 */
export function snapshotToReport(
  snapshot: Snapshot,
  title: string,
  description: string,
  annotatedImage: string,
): Report {
  const step: Step = {
    id: snapshot.id,
    index: 1,
    timestamp: snapshot.createdAt,
    event: {
      type: "navigate",
      tagName: "",
      id: null,
      className: null,
      textContent: null,
      ariaLabel: null,
      placeholder: null,
      fieldLabel: null,
      href: null,
      inputType: null,
      xpath: "",
      pathname: pathOf(snapshot.tabUrl),
    },
    screenshot: annotatedImage,
    reactComponent: null,
    autoDescription: "Annotated screenshot",
    editedDescription: null,
  };

  const session: RepruviaSession = {
    id: snapshot.id,
    startedAt: snapshot.createdAt,
    endedAt: snapshot.createdAt,
    tabUrl: snapshot.tabUrl,
    environment: {
      url: snapshot.tabUrl,
      browserName: "",
      browserVersion: "",
      os: "",
      viewportWidth: snapshot.width,
      viewportHeight: snapshot.height,
      devicePixelRatio: 1,
      userAgent: "",
      recordingStartTime: isoFromMs(snapshot.createdAt),
    },
    steps: [step],
    consoleErrors: [],
    networkFailures: [],
  };

  return {
    session,
    meta: { title: title.trim() || "Screenshot", description, severity: "medium" },
  };
}
