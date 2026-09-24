import { LIMITS, type DomEvent, type DomEventType } from "@repruvia/shared";

/** Compute a stable-ish XPath for an element (used for React bridge lookups). */
export function getXPath(element: Element): string {
  // An id containing a double quote can't be written as an XPath literal here.
  if (element.id && !element.id.includes('"')) return `//*[@id="${element.id}"]`;
  const segments: string[] = [];
  let node: Element | null = element;
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = node.previousElementSibling;
    while (sibling) {
      if (sibling.nodeName === node.nodeName) index += 1;
      sibling = sibling.previousElementSibling;
    }
    segments.unshift(`${node.nodeName.toLowerCase()}[${index}]`);
    node = node.parentElement;
  }
  return `/${segments.join("/")}`;
}

/** Resolve a form field's label via `<label for>`, `aria-labelledby`, or wrapping label. */
function resolveFieldLabel(element: Element): string | null {
  const id = element.getAttribute("id");
  if (id) {
    const explicit = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (explicit?.textContent) return explicit.textContent.trim();
  }
  // aria-labelledby is a space-separated id list; the accessible name joins them.
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((ref) => document.getElementById(ref)?.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    if (text) return text;
  }
  const wrapping = element.closest("label");
  if (wrapping?.textContent) return wrapping.textContent.trim();
  return null;
}

/** First test-id-style attribute, the most reliable element handle for QA. */
function resolveTestId(element: Element): { attr: string; value: string } | null {
  for (const attr of ["data-testid", "data-test", "data-cy", "data-qa"]) {
    const value = element.getAttribute(attr);
    if (value) return { attr, value };
  }
  return null;
}

/** A short, human-readable CSS selector: tag + id / test-id / first classes. */
function buildSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${CSS.escape(element.id)}`;
  const testId = resolveTestId(element);
  if (testId) return `${tag}[${testId.attr}="${testId.value.replace(/["\\]/g, "\\$&")}"]`;
  if (typeof element.className === "string" && element.className.trim()) {
    const classes = element.className
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((c) => CSS.escape(c))
      .join(".");
    return `${tag}.${classes}`;
  }
  return tag;
}

function truncate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > LIMITS.TEXT_CONTENT_MAX
    ? `${trimmed.slice(0, LIMITS.TEXT_CONTENT_MAX)}…`
    : trimmed;
}

/** Editable regions whose text is something the user typed (a value, not a label). */
const USER_TEXT_SELECTOR = 'textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

/**
 * Visible text for a step label — but never text the user typed. Typing events
 * never carry text, and neither does a click on/inside an editable region
 * (a contenteditable's `textContent` IS its value).
 */
function safeTextContent(type: DomEventType, element: Element): string | null {
  if (type !== "click") return null;
  if ((element as HTMLElement).isContentEditable || element.closest(USER_TEXT_SELECTOR)) return null;
  if (element.querySelector(USER_TEXT_SELECTOR)) return null;
  return truncate(element.textContent);
}

/**
 * Build a privacy-safe `DomEvent` from a target element. Field *values* are
 * never read — only structural metadata, labels, and placeholders (TRD §3.1).
 */
export function buildDomEvent(type: DomEventType, element: Element): DomEvent {
  const anchor = element.closest("a");
  const formControl = element as Partial<HTMLInputElement>;
  const isToggle = formControl.type === "checkbox" || formControl.type === "radio";

  return {
    type,
    tagName: element.tagName,
    id: element.getAttribute("id"),
    className: typeof element.className === "string" ? element.className || null : null,
    textContent: safeTextContent(type, element),
    ariaLabel: element.getAttribute("aria-label"),
    placeholder: element.getAttribute("placeholder"),
    fieldLabel: resolveFieldLabel(element),
    href: anchor?.getAttribute("href") ?? null,
    inputType: formControl.type ?? null,
    xpath: getXPath(element),
    pathname: location.pathname,
    role: element.getAttribute("role"),
    name: element.getAttribute("name"),
    title: truncate(element.getAttribute("title")),
    alt: element.getAttribute("alt"),
    testId: resolveTestId(element)?.value ?? null,
    selector: buildSelector(element),
    checked: isToggle ? Boolean(formControl.checked) : null,
  };
}
