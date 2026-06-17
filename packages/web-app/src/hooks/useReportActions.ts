import { useMemo } from "react";
import type { Report } from "@repruvia/shared";
import { toast } from "sonner";
import { useMarkdownExport } from "@/hooks/useMarkdownExport";
import { printReportAsPdf } from "@/lib/exportPdf";
import { reportToMarkdown, reportToPlainText } from "@/lib/reportText";

export interface ReportActions {
  exportMarkdown: () => void;
  exportPdf: () => void;
  copyMarkdown: () => void;
  copyText: () => void;
}

async function copy(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Couldn't copy to the clipboard");
  }
}

/** All non-ticket report actions (export / copy) with their user feedback. */
export function useReportActions(report: Report | null): ReportActions {
  const exportMarkdown = useMarkdownExport(report);

  return useMemo<ReportActions>(
    () => ({
      exportMarkdown: () => {
        exportMarkdown();
        toast.success("Markdown exported");
      },
      exportPdf: () => {
        if (!report) return;
        try {
          printReportAsPdf(report);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't export PDF");
        }
      },
      copyMarkdown: () => {
        if (report) void copy(reportToMarkdown(report), "Markdown");
      },
      copyText: () => {
        if (report) void copy(reportToPlainText(report), "Text");
      },
    }),
    [report, exportMarkdown],
  );
}
