import { resolveStepText, SEVERITIES, type Report, type Severity } from "@repruvia/shared";
import type { ChatMessage, ContentPart } from "./types";

/** Structured result the model is asked to produce in one shot. */
export interface AnalysisResult {
  title: string;
  severity: Severity;
  description: string;
  /** Improved one-line phrasings, one per step, in the SAME order as the input. */
  steps: string[];
}

/** JSON Schema used to grammar-constrain the model's output (WebLLM JSON mode). */
export const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    severity: { type: "string", enum: SEVERITIES },
    description: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["title", "severity", "description", "steps"],
} as const;

const SYSTEM_PROMPT = [
  "You are a senior QA engineer analyzing a captured browser bug session.",
  "Respond with ONLY a single JSON object — no prose, no markdown fences.",
  "Shape:",
  '{"title": string, "severity": "low"|"medium"|"high"|"critical", "description": string, "steps": [{"index": number, "title": string}]}.',
  "Rules:",
  "- title: concise bug title, max 80 chars.",
  "- severity: judge ONLY from the evidence (console errors / failed requests). No errors → low or medium.",
  "- description: clear Markdown, under 150 words, summary + likely expected vs actual. Never invent details.",
  "- steps: an array of improved one-line action phrases, ONE PER PROVIDED STEP, in the SAME order. Return exactly as many entries as there are steps.",
  "  Keep Markdown code formatting: wrap URL paths and element/tag names in backticks, e.g. Clicked \"Submit\" `button` on `/checkout`.",
].join("\n");

/**
 * Safety net so step phrasing always keeps highlighted paths even if the model
 * drops the backticks: wrap bare URL paths (e.g. `/checkout`) in code, unless
 * they're already inside a backtick span.
 */
export function formatStepMarkdown(text: string): string {
  return text.replace(
    /(`[^`]*`)|((?<![A-Za-z0-9])\/[A-Za-z0-9\-_./]+)/g,
    (_match, code: string | undefined, path: string | undefined) =>
      code ?? (path ? `\`${path}\`` : ""),
  );
}

/** Build the chat messages for a full one-shot analysis of a session. */
export function buildAnalysisMessages(report: Report): ChatMessage[] {
  const { session, meta } = report;

  const steps = session.steps
    .map((s) => {
      const e = s.event;
      const ctx = [
        e.selector && `selector ${e.selector}`,
        e.role && `role ${e.role}`,
        e.testId && `testid ${e.testId}`,
      ]
        .filter(Boolean)
        .join(", ");
      return `${s.index}. ${resolveStepText(s)}${ctx ? ` (${ctx})` : ""}`;
    })
    .join("\n");
  const consoleErrors =
    session.consoleErrors.map((c) => `- [${c.level}] ${c.message}`).join("\n") || "none";
  const networkFailures =
    session.networkFailures.map((n) => `- ${n.method} ${n.url} → ${n.status}`).join("\n") || "none";

  const user = [
    `URL: ${session.environment.url}`,
    `Current severity guess: ${meta.severity}`,
    "",
    `Steps (rewrite each into a clear phrase; return exactly ${session.steps.length} in order):`,
    steps || "none recorded",
    "",
    "Console errors:",
    consoleErrors,
    "",
    "Failed network requests:",
    networkFailures,
  ].join("\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

/** A single report field the user can refine in place with AI. */
export type RefineField = "title" | "description" | "step";

const REFINE_SYSTEM: Record<RefineField, string> = {
  title:
    "You are a senior QA engineer. Rewrite the given text into ONE concise, specific bug-report title (max 80 chars). Output ONLY the title — no quotes, no markdown, no preamble.",
  description:
    "You are a senior QA engineer. Rewrite the given text into a clear bug description in Markdown, under 150 words: a short summary plus the likely expected vs actual behaviour. Use ONLY the provided evidence; never invent details. Output ONLY the description.",
  step:
    "You are a senior QA engineer. Rewrite the given line into ONE clear, concise sentence describing what the tester did. Keep Markdown code formatting (wrap URL paths and element/tag names in backticks). Output ONLY the single line — no list marker, no quotes, no preamble.",
};

/** Compact session summary used to ground title/description refinements. */
function sessionContext(report: Report): string {
  const { session } = report;
  const steps = session.steps.map((s) => `${s.index}. ${resolveStepText(s)}`).join("\n");
  const errors =
    session.consoleErrors.map((c) => `- [${c.level}] ${c.message}`).join("\n") || "none";
  return [
    `URL: ${session.environment.url}`,
    "Steps:",
    steps || "none recorded",
    "Console errors:",
    errors,
  ].join("\n");
}

/** Build chat messages to refine a single field in place (plain-text output). */
export function buildFieldRefineMessages(
  field: RefineField,
  current: string,
  report: Report,
  screenshot?: string | null,
): ChatMessage[] {
  const userText =
    field === "step"
      ? `Rewrite this step line${screenshot ? " (a screenshot of the step is attached)" : ""}:\n${current || "(empty)"}`
      : [
          `Current ${field}:`,
          current || "(empty)",
          "",
          "Session context for grounding:",
          sessionContext(report),
        ].join("\n");

  const userContent: string | ContentPart[] =
    field === "step" && screenshot
      ? [
          { type: "text", text: userText },
          { type: "image", dataUrl: screenshot },
        ]
      : userText;

  return [
    { role: "system", content: REFINE_SYSTEM[field] },
    { role: "user", content: userContent },
  ];
}

/**
 * Parse the model's JSON output tolerantly. Returns a partial result; callers
 * apply only the fields that are present and valid, so a flaky field never
 * blocks the rest.
 */
export function parseAnalysis(raw: string): Partial<AnalysisResult> {
  let json = raw.trim();
  if (!json.startsWith("{")) {
    const match = /\{[\s\S]*\}/.exec(json);
    if (!match) return {};
    json = match[0];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }

  const result: Partial<AnalysisResult> = {};
  if (typeof parsed.title === "string" && parsed.title.trim()) {
    result.title = parsed.title.trim().slice(0, 120);
  }
  if (typeof parsed.severity === "string" && (SEVERITIES as string[]).includes(parsed.severity)) {
    result.severity = parsed.severity as Severity;
  }
  if (typeof parsed.description === "string" && parsed.description.trim()) {
    result.description = parsed.description.trim();
  }
  if (Array.isArray(parsed.steps)) {
    result.steps = parsed.steps
      .map((s) => {
        // Tolerate both plain strings and {title}/{text} objects.
        if (typeof s === "string") return s.trim();
        if (s && typeof s === "object") {
          const obj = s as { title?: unknown; text?: unknown };
          if (typeof obj.title === "string") return obj.title.trim();
          if (typeof obj.text === "string") return obj.text.trim();
        }
        return "";
      })
      .filter((s) => s.length > 0);
  }
  return result;
}
