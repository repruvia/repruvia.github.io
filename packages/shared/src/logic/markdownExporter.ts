import type { Report, Step } from "../types/domain.js";
import { assignNearestSteps, groupByStep, resolveStepText } from "./report.js";
import { SEVERITY_LABELS } from "./severity.js";
import { relativeTime } from "./time.js";

export interface MarkdownExportOptions {
  /**
   * How to include step screenshots:
   *  - `embed` (default): inline base64 data URLs (self-contained, huge file)
   *  - `link`: reference a relative path from `screenshotPath` (clean .md, for a
   *    ZIP bundle where the images are separate files)
   *  - `omit`: no images (e.g. when uploaded separately as ticket attachments)
   */
  screenshots?: "embed" | "link" | "omit";
  /** Relative path for a step's image when `screenshots` is `link`. */
  screenshotPath?: (step: Step) => string;
  /** Reporter display name. */
  reportedBy?: string;
}

/**
 * Render a full bug report as Markdown (TRD §9). Pure and deterministic so it
 * can be unit-tested and reused as the body for Linear/Jira issue descriptions.
 */
export function exportReportToMarkdown(report: Report, options: MarkdownExportOptions = {}): string {
  const { screenshots = "embed", screenshotPath, reportedBy } = options;
  const { session, meta } = report;
  const { environment: env } = session;

  const consoleByStep = groupByStep(assignNearestSteps(session.consoleErrors, session.steps));
  const networkByStep = groupByStep(assignNearestSteps(session.networkFailures, session.steps));

  const lines: string[] = [];

  lines.push(`# Bug Report: ${meta.title || "Untitled"}`, "");
  lines.push(`**Severity:** ${SEVERITY_LABELS[meta.severity]}  `);
  if (reportedBy) lines.push(`**Reported by:** ${reportedBy}  `);
  lines.push(`**Date:** ${env.recordingStartTime}  `, "");

  lines.push("## Environment", "");
  lines.push(`- **URL:** ${env.url}`);
  lines.push(`- **Browser:** ${env.browserName} ${env.browserVersion}`);
  lines.push(`- **OS:** ${env.os}`);
  lines.push(`- **Viewport:** ${env.viewportWidth} × ${env.viewportHeight}`, "");

  if (meta.description.trim()) {
    lines.push("## Description", "", meta.description.trim(), "");
  }

  lines.push("## Steps to Reproduce", "");
  for (const step of session.steps) {
    lines.push(`### Step ${step.index} — ${resolveStepText(step)}`);
    if (step.screenshot && screenshots !== "omit") {
      const src =
        screenshots === "link" && screenshotPath ? screenshotPath(step) : step.screenshot;
      lines.push(`![Step ${step.index}](${src})`, "");
    }
    appendStepContext(lines, step, consoleByStep, networkByStep, session.startedAt);
    lines.push("");
  }

  if (session.consoleErrors.length > 0) {
    lines.push("## Console Errors", "");
    lines.push("| Time | Level | Message |", "|---|---|---|");
    for (const entry of session.consoleErrors) {
      lines.push(
        `| ${relativeTime(entry.timestamp, session.startedAt)} | ${entry.level.toUpperCase()} | ${escapeCell(entry.message)} |`,
      );
    }
    lines.push("");
  }

  if (session.networkFailures.length > 0) {
    lines.push("## Network Failures", "");
    lines.push("| Time | Method | URL | Status |", "|---|---|---|---|");
    for (const failure of session.networkFailures) {
      lines.push(
        `| ${relativeTime(failure.timestamp, session.startedAt)} | ${failure.method} | ${escapeCell(failure.url)} | ${failure.status} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function appendStepContext(
  lines: string[],
  step: Step,
  consoleByStep: Map<string, { level: string; message: string }[]>,
  networkByStep: Map<string, { method: string; url: string; status: number }[]>,
  startedAt: number,
): void {
  void startedAt;
  if (step.reactComponent) {
    const props = JSON.stringify(step.reactComponent.props);
    lines.push(`⚛ Component: \`<${step.reactComponent.name}>\`  props: \`${props}\``);
  }
  for (const c of consoleByStep.get(step.id) ?? []) {
    lines.push(`⚠ Console ${c.level}: ${escapeCell(c.message)}`);
  }
  for (const n of networkByStep.get(step.id) ?? []) {
    lines.push(`🔴 Network: ${n.method} ${n.url} → ${n.status}`);
  }
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
