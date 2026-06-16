import { LIMITS, type DomEvent, type DomEventType } from "@repruvia/shared";

/** Compute a stable-ish XPath for an element (used for React bridge lookups). */
export function getXPath(element: Element): string {
  if (element.id) return `//*[@id="${element.id}"]`;
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
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref?.textContent) return ref.textContent.trim();
  }
  const wrapping = element.closest("label");
  if (wrapping?.textContent) return wrapping.textContent.trim();
  return null;
}

/** First test-id-style attribute, the most reliable element handle for QA. */
function resolveTestId(element: Element): string | null {
  for (const attr of ["data-testid", "data-test", "data-cy", "data-qa"]) {
    const value = element.getAttribute(attr);
    if (value) return value;
  }
  return null;
}

/** A short, human-readable CSS selector: tag + id / test-id / first classes. */
function buildSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${element.id}`;
  const testId = resolveTestId(element);
  if (testId) return `${tag}[data-testid="${testId}"]`;
  if (typeof element.className === "string" && element.className.trim()) {
    const classes = element.className.trim().split(/\s+/).slice(0, 2).join(".");
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
    textContent: truncate(element.textContent),
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
    testId: resolveTestId(element),
    selector: buildSelector(element),
    checked: isToggle ? Boolean(formControl.checked) : null,
  };
}
