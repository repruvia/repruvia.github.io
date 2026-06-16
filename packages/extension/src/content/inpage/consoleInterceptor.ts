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
      postToContent({
        source: "repruvia",
        kind: "console",
        level,
        message: args.map(stringifyArg).join(" "),
        timestamp: Date.now(),
      });
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
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}
