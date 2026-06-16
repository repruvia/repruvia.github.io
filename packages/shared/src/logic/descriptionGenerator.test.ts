import { describe, expect, it } from "vitest";
import { generateDescription } from "./descriptionGenerator.js";
import type { DomEvent } from "../types/domain.js";

function event(overrides: Partial<DomEvent>): DomEvent {
  return {
    type: "click",
    tagName: "BUTTON",
    id: null,
    className: null,
    textContent: null,
    ariaLabel: null,
    placeholder: null,
    fieldLabel: null,
    href: null,
    inputType: null,
    xpath: "/html/body/button",
    pathname: "/checkout",
    ...overrides,
  };
}

describe("generateDescription", () => {
  it("prefers aria-label, then text content for clicks (Markdown code for tag + path)", () => {
    expect(generateDescription(event({ ariaLabel: "Place Order" }))).toBe(
      'Clicked "Place Order" `button` on `/checkout`',
    );
    expect(generateDescription(event({ textContent: "Submit" }))).toBe(
      'Clicked "Submit" `button` on `/checkout`',
    );
  });

  it("skips long identifier-blob text content in favor of a test id", () => {
    const blob = "search_itemslist_block_categorieslist_blocks_in_categoryget_item";
    expect(
      generateDescription(event({ tagName: "DIV", textContent: blob, testId: "result-item" })),
    ).toBe('Clicked "result-item" `div` on `/checkout`');
  });

  it("describes inputs by field label without leaking values", () => {
    const result = generateDescription(
      event({ type: "input", tagName: "INPUT", fieldLabel: "Email Address" }),
    );
    expect(result).toBe('Entered text in "Email Address" `input` on `/checkout`');
  });

  it("describes navigation by pathname as code", () => {
    expect(generateDescription(event({ type: "navigate", pathname: "/dashboard/orders" }))).toBe(
      "Navigated to `/dashboard/orders`",
    );
  });

  it("falls back gracefully when metadata is sparse", () => {
    expect(generateDescription(event({ type: "input", fieldLabel: null }))).toBe(
      'Entered text in "a text field" `input` on `/checkout`',
    );
  });
});
