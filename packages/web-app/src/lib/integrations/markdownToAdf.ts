/**
 * Minimal Markdown → Atlassian Document Format converter. Covers the structure
 * Repruvia emits (headings, paragraphs, bullet lines). Images are dropped — they
 * are uploaded as real attachments instead, which renders better in Jira.
 */
export interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

export interface AdfDoc {
  version: 1;
  type: "doc";
  content: AdfNode[];
}

export function markdownToAdf(markdown: string): AdfDoc {
  const content: AdfNode[] = [];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith("![")) continue; // image — handled as attachment

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      content.push({
        type: "heading",
        attrs: { level: Math.min(6, heading[1]!.length) },
        content: [{ type: "text", text: stripInline(heading[2]!) }],
      });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      content.push({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: stripInline(bullet[1]!) }] }],
          },
        ],
      });
      continue;
    }

    content.push({ type: "paragraph", content: [{ type: "text", text: stripInline(line) }] });
  }

  return { version: 1, type: "doc", content };
}

function stripInline(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/`(.*?)`/g, "$1");
}
