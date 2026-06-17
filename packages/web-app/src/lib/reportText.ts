import { exportReportToMarkdown, type Report } from "@repruvia/shared";
import { loadSettings } from "@/lib/settings";

/** Clean Markdown for the clipboard — screenshots omitted so it pastes anywhere. */
export function reportToMarkdown(report: Report): string {
  const reportedBy = loadSettings().reporterName || undefined;
  return exportReportToMarkdown(report, { screenshots: "omit", reportedBy });
}

/** Plain text: Markdown with the syntax stripped, for pasting into chat/email. */
export function reportToPlainText(report: Report): string {
  return reportToMarkdown(report)
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, "").trim())
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^>\s?/gm, "") // blockquotes
    .replace(/^\s*[-*]\s+/gm, "• ") // bullets
    .replace(/(\*\*|__|\*|_|`)/g, "") // emphasis / inline code
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
