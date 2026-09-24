import { LIMITS, truncateText } from "@repruvia/shared";
import { postToContent } from "./post.js";

/**
 * Wraps `console.error`/`console.warn` to forward messages to Repruvia while
 * preserving the original behaviour. Idempotent and reversible.
 */
export function installConsoleInterceptor(): () => void {
  const original: Partial<Record<"error" | "warn", typeof console.error>> = {};

  (["error", "warn"] as const).forEach((level) => {
    const fn = console[level].bind(console);
    original[level] = fn;
    console[level] = (...args: unknown[]) => {
      // This runs inside the page's own call: capturing must never throw into it.
      try {
        postToContent({
          source: "repruvia",
          kind: "console",
          level,
          // Cap here too so a huge object dump isn't serialized across every hop.
          message: truncateText(args.map(stringifyArg).join(" "), LIMITS.CONSOLE_MESSAGE_MAX),
          timestamp: Date.now(),
        });
      } catch {
        // unserializable argument — skip capture, keep the page's log
      }
      fn(...args);
    };
  });

  return () => {
    if (original.error) console.error = original.error;
    if (original.warn) console.warn = original.warn;
  };
}

function stringifyArg(arg: unknown): string {
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  // DOM nodes JSON-stringify to "{}" — describe them instead.
  if (arg instanceof Element) return `<${arg.tagName.toLowerCase()}>`;
  if (typeof arg === "object" && arg !== null) {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}
