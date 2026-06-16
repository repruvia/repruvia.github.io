import type { DomEvent } from "../types/domain.js";

/**
 * Deterministically generate a human-readable step description from DOM event
 * metadata. Output is **Markdown**: paths and element tags are wrapped in
 * `` `code` `` so the UI (and exported report) can highlight them. No AI, no
 * network — pure function, fully unit-testable (TRD §8).
 */
export function generateDescription(event: DomEvent): string {
  const location = event.pathname ? ` on \`${event.pathname}\`` : "";
  const tag = `\`${event.tagName.toLowerCase()}\``;

  switch (event.type) {
    case "click": {
      const label = clickLabel(event);
      return `Clicked "${label}" ${tag}${location}`;
    }

    case "input": {
      const fieldName = firstNonEmpty(
        event.fieldLabel,
        event.ariaLabel,
        event.placeholder,
        event.title,
        event.name,
        event.id,
        "a text field",
      );
      return `Entered text in "${fieldName}" \`input\`${location}`;
    }

    case "change": {
      const fieldName = firstNonEmpty(
        event.fieldLabel,
        event.ariaLabel,
        event.title,
        event.name,
        event.id,
        "a field",
      );
      return `Changed "${fieldName}" ${tag}${location}`;
    }

    case "navigate":
      return `Navigated to \`${event.pathname}\``;

    default:
      return `Interacted with page${location}`;
  }
}

/**
 * Pick the best label for a clicked element. Prefers accessible names, then a
 * short visible label, then identifying attributes — avoiding long, blobby
 * `textContent` (e.g. a generated class string) that reads as noise.
 */
function clickLabel(event: DomEvent): string {
  const visibleText = isLabelLike(event.textContent) ? event.textContent : null;
  return firstNonEmpty(
    event.ariaLabel,
    visibleText,
    event.fieldLabel,
    event.title,
    event.alt,
    event.placeholder,
    event.testId,
    event.name,
    event.id,
    event.role,
    event.tagName.toLowerCase(),
  );
}

/** Heuristic: real labels have spaces or are short; identifier blobs don't. */
function isLabelLike(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return trimmed.length <= 40 || /\s/.test(trimmed);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}
