/**
 * Minimal Markdown → Atlassian Document Format converter. Covers the structure
 * Repruvia emits (headings, paragraphs, bullet lines, images). An image line
 * `![alt](path)` becomes an ADF `media` node when `resolveMedia` maps its path to
 * an uploaded Jira attachment; otherwise it is dropped (the attachment still
 * shows in the issue's attachment panel).
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

/** Resolve an image markdown path to an uploaded Jira media reference, or null to drop it. */
export type MediaResolver = (path: string) => { id: string; collection?: string } | null;

export function markdownToAdf(markdown: string, resolveMedia?: MediaResolver): AdfDoc {
  const content: AdfNode[] = [];

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const image = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(line);
    if (image) {
      const media = resolveMedia?.(image[2]!);
      if (media) {
        content.push({
          type: "mediaSingle",
          attrs: { layout: "center" },
          content: [
            {
              type: "media",
              attrs: {
                type: "file",
                id: media.id,
                // Include `collection` whenever provided (empty string is valid
                // and required for issue-attached files).
                ...(media.collection !== undefined ? { collection: media.collection } : {}),
              },
            },
          ],
        });
      }
      continue; // unresolved image — handled as a plain attachment
    }

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
