import type { RepruviaSession, ReportAttachment } from "@repruvia/shared";
import { dataUrlToBlob } from "./dataUrl";

/** Stable per-step screenshot filename — shared so providers can map uploads back to steps. */
export function screenshotAttachmentName(stepIndex: number): string {
  return `step-${String(stepIndex).padStart(2, "0")}.png`;
}

/** Build the ordered attachment list from step screenshots. */
export function buildAttachments(session: RepruviaSession): ReportAttachment[] {
  const attachments: ReportAttachment[] = [];

  for (const step of session.steps) {
    if (!step.screenshot) continue;
    attachments.push({
      filename: screenshotAttachmentName(step.index),
      mimeType: "image/png",
      data: dataUrlToBlob(step.screenshot),
    });
  }

  return attachments;
}
