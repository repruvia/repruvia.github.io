import type { ChatMessage } from "./types";

/** A snapshot field the model can draft from the (annotated) image. */
export type SnapshotField = "title" | "description";

const SYSTEM: Record<SnapshotField, string> = {
  title:
    "You are a senior QA engineer. Look at this screenshot of a UI issue (it may include hand-drawn arrows, boxes, or notes highlighting the problem) and write ONE concise, specific bug-report title, max 80 chars. Pay attention to anything circled or pointed at. Output ONLY the title — no quotes, no markdown, no preamble.",
  description:
    "You are a senior QA engineer. Look at this screenshot of a UI issue (it may include hand-drawn arrows, boxes, or notes highlighting the problem) and write a clear bug description in Markdown, under 150 words: a short summary plus the likely expected vs actual behaviour. Describe ONLY what is visible — never invent details. Output ONLY the description.",
};

/** Build messages to draft one field from a flattened snapshot (screenshot + annotations) so the model sees the markup. */
export function buildSnapshotFieldMessages(
  field: SnapshotField,
  image: string,
  current: string,
): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM[field] },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: current.trim()
            ? `Current ${field} (improve or replace):\n${current.trim()}`
            : `Draft the ${field} from this screenshot of the issue:`,
        },
        { type: "image", dataUrl: image },
      ],
    },
  ];
}
