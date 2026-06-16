import { LIMITS, type ReactInfo } from "@repruvia/shared";
import { getXPath } from "../dom/elementMetadata.js";
import { postToContent } from "./post.js";

interface Fiber {
  type?: { displayName?: string; name?: string } | string | null;
  memoizedProps?: Record<string, unknown>;
  return?: Fiber | null;
}

const SKIP_NAMES = new Set(["div", "span", "a", "button", "input", "p", "li", "ul"]);

/** Read the nearest named React component for a DOM node via its fiber. */
function getReactComponent(element: Element): ReactInfo | null {
  if (!(window as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown }).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return null;
  }
  const fiberKey = Object.keys(element).find(
    (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
  );
  if (!fiberKey) return null;

  let fiber = (element as unknown as Record<string, Fiber | undefined>)[fiberKey] ?? null;
  while (fiber) {
    const type = fiber.type;
    const name =
      typeof type === "object" && type ? (type.displayName ?? type.name) : undefined;
    if (name && !SKIP_NAMES.has(name)) {
      return { name, props: sanitizeProps(fiber.memoizedProps) };
    }
    fiber = fiber.return ?? null;
  }
  return null;
}

/** Keep only serializable primitive props, capped in count (TRD §3.5). */
function sanitizeProps(props?: Record<string, unknown>): ReactInfo["props"] {
  const entries = Object.entries(props ?? {})
    .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
    .slice(0, LIMITS.REACT_PROPS_MAX) as [string, string | number | boolean][];
  return Object.fromEntries(entries);
}

/**
 * On every interaction, resolve the React component for the target and post it
 * to the content script (which forwards it to the SW for step correlation).
 * Silently no-ops on non-React pages.
 */
export function installReactBridge(): () => void {
  const handler = (e: Event): void => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    const info = getReactComponent(el);
    if (info) postToContent({ source: "repruvia", kind: "react", xpath: getXPath(el), info });
  };

  document.addEventListener("click", handler, true);
  document.addEventListener("input", handler, true);
  document.addEventListener("change", handler, true);
  return () => {
    document.removeEventListener("click", handler, true);
    document.removeEventListener("input", handler, true);
    document.removeEventListener("change", handler, true);
  };
}
