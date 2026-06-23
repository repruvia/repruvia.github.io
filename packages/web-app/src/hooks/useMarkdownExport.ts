import { useCallback } from "react";
import { exportReportToMarkdown, type Report } from "@repruvia/shared";
import { downloadTextFile } from "@/lib/download";
import { loadSettings } from "@/lib/settings";

/**
 * Exports the report as a single, self-contained `.md` with screenshots inlined
 * as base64 data URLs (no ZIP, no separate image files).
 */
export function useMarkdownExport(report: Report | null) {
  return useCallback(() => {
    if (!report) return;
    const reportedBy = loadSettings().reporterName || undefined;
    const slug =
      report.meta.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
      "bug-report";

    const markdown = exportReportToMarkdown(report, { screenshots: "embed", reportedBy });
    downloadTextFile(`${slug}.md`, markdown);
  }, [report]);
}
