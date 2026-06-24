import { describe, expect, it } from "vitest";
import { exportReportToMarkdown } from "./markdownExporter.js";
import type { Report, Step } from "../types/domain.js";

function step(index: number, screenshot: string | null): Step {
  return {
    id: `s${index}`,
    index,
    timestamp: index * 1000,
    event: {
      type: "click",
      tagName: "BUTTON",
      id: null,
      className: null,
      textContent: "x",
      ariaLabel: null,
      placeholder: null,
      fieldLabel: null,
      href: null,
      inputType: null,
      xpath: "/",
      pathname: "/",
    },
    screenshot,
    reactComponent: null,
    autoDescription: `auto-${index}`,
    editedDescription: null,
  };
}

function report(steps: Step[]): Report {
  return {
    meta: { title: "Bug", description: "", severity: "high" },
    session: {
      id: "sess",
      startedAt: 0,
      endedAt: null,
      tabUrl: "https://example.com",
      environment: {
        url: "https://example.com",
        browserName: "Chrome",
        browserVersion: "120",
        os: "macOS",
        viewportWidth: 1280,
        viewportHeight: 800,
        devicePixelRatio: 2,
        userAgent: "UA",
        recordingStartTime: "2026-01-01T00:00:00.000Z",
      },
      steps,
      consoleErrors: [],
      networkFailures: [],
    },
  };
}

describe("exportReportToMarkdown screenshots", () => {
  it("embed inlines the data URL", () => {
    const md = exportReportToMarkdown(report([step(1, "data:image/png;base64,AAA")]), {
      screenshots: "embed",
    });
    expect(md).toContain("![Step 1](data:image/png;base64,AAA)");
  });

  it("omit emits no image", () => {
    const md = exportReportToMarkdown(report([step(1, "data:image/png;base64,AAA")]), {
      screenshots: "omit",
    });
    expect(md).not.toContain("![Step 1]");
  });

  it("link uses the resolver path", () => {
    const md = exportReportToMarkdown(report([step(1, "data:image/png;base64,AAA")]), {
      screenshots: "link",
      screenshotPath: () => "https://cdn/img.png",
    });
    expect(md).toContain("![Step 1](https://cdn/img.png)");
  });

  it("link skips the image when the resolver returns empty (e.g. failed upload)", () => {
    const md = exportReportToMarkdown(report([step(1, "data:image/png;base64,AAA")]), {
      screenshots: "link",
      screenshotPath: () => "",
    });
    expect(md).not.toContain("![Step 1]");
    expect(md).not.toContain("![Step 1]()");
  });
});
