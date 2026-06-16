import { useCallback } from "react";
import { zipSync, strToU8 } from "fflate";
import { exportReportToMarkdown, type Report, type Step } from "@repruvia/shared";
import { downloadBlob, downloadTextFile } from "@/lib/download";
import { dataUrlToBytes } from "@/lib/dataUrl";
import { loadSettings } from "@/lib/settings";

const screenshotPath = (step: Step): string =>
  `screenshots/step-${String(step.index).padStart(2, "0")}.png`;

/**
 * Exports the report. With screenshots, it produces a ZIP — a clean `report.md`
 * that links images as separate files (no megabyte base64 data URLs inline) plus
 * a `screenshots/` folder. Without screenshots, a plain `.md`.
 */
export function useMarkdownExport(report: Report | null) {
  return useCallback(() => {
    if (!report) return;
    const reportedBy = loadSettings().reporterName || undefined;
    const slug =
      report.meta.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      "bug-report";

    const stepsWithShots = report.session.steps.filter((s) => s.screenshot);

    if (stepsWithShots.length === 0) {
      downloadTextFile(`${slug}.md`, exportReportToMarkdown(report, { screenshots: "omit", reportedBy }));
      return;
    }

    const markdown = exportReportToMarkdown(report, {
      screenshots: "link",
      screenshotPath,
      reportedBy,
    });

    const files: Record<string, Uint8Array> = { "report.md": strToU8(markdown) };
    for (const step of stepsWithShots) {
      files[screenshotPath(step)] = dataUrlToBytes(step.screenshot!);
    }

    const zipped = zipSync(files, { level: 6 });
    // Copy into a plain ArrayBuffer for a well-typed, self-contained Blob.
    const buffer = new ArrayBuffer(zipped.byteLength);
    new Uint8Array(buffer).set(zipped);
    downloadBlob(`${slug}.zip`, new Blob([buffer], { type: "application/zip" }));
  }, [report]);
}
