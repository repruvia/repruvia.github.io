import type { RepruviaSession, ReportAttachment } from "@repruvia/shared";
import { dataUrlToBlob } from "./dataUrl";

/** Build the ordered attachment list from step screenshots. */
export function buildAttachments(session: RepruviaSession): ReportAttachment[] {
  const attachments: ReportAttachment[] = [];

  for (const step of session.steps) {
    if (!step.screenshot) continue;
    attachments.push({
      filename: `step-${String(step.index).padStart(2, "0")}.png`,
      mimeType: "image/png",
      data: dataUrlToBlob(step.screenshot),
    });
  }

  return attachments;
}
