import {
  assignNearestSteps,
  groupByStep,
  relativeTime,
  resolveStepText,
  SEVERITY_LABELS,
  type Report,
} from "@repruvia/shared";
import { loadSettings } from "@/lib/settings";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(report: Report): string {
  const { session, meta } = report;
  const reportedBy = loadSettings().reporterName || "";
  const startedAt = session.startedAt;
  const consoleByStep = groupByStep(assignNearestSteps(session.consoleErrors, session.steps));
  const networkByStep = groupByStep(assignNearestSteps(session.networkFailures, session.steps));

  const metaBits = [
    `Severity: ${SEVERITY_LABELS[meta.severity]}`,
    reportedBy && `Reported by: ${esc(reportedBy)}`,
    session.environment.url && `URL: ${esc(session.environment.url)}`,
  ].filter(Boolean);

  const stepsHtml = session.steps
    .map((step) => {
      const errs = [
        ...(consoleByStep.get(step.id) ?? []).map(
          (e) => `<li>${esc(e.level.toUpperCase())}: ${esc(e.message)}</li>`,
        ),
        ...(networkByStep.get(step.id) ?? []).map(
          (f) => `<li>${esc(f.method)} ${esc(f.url)} → ${f.status}</li>`,
        ),
      ].join("");
      const shot = step.screenshot
        ? `<img src="${step.screenshot}" alt="Step ${step.index}" />`
        : "";
      return `
        <section class="step">
          <h3>${step.index}. ${esc(resolveStepText(step))}</h3>
          ${shot}
          ${errs ? `<ul class="errors">${errs}</ul>` : ""}
        </section>`;
    })
    .join("");

  const issuesHtml =
    session.consoleErrors.length || session.networkFailures.length
      ? `
        <h2>Issues</h2>
        <ul class="errors">
          ${session.consoleErrors
            .map(
              (e) =>
                `<li>${esc(relativeTime(e.timestamp, startedAt))} · ${esc(
                  e.level.toUpperCase(),
                )}: ${esc(e.message)}</li>`,
            )
            .join("")}
          ${session.networkFailures
            .map(
              (f) =>
                `<li>${esc(relativeTime(f.timestamp, startedAt))} · ${esc(f.method)} ${esc(
                  f.url,
                )} → ${f.status}</li>`,
            )
            .join("")}
        </ul>`
      : "";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(meta.title || "Bug report")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 32px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 24px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 0 0 8px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  .meta span { margin-right: 12px; }
  .description { white-space: pre-wrap; font-size: 13px; }
  .step { page-break-inside: avoid; margin: 16px 0; padding: 12px; border: 1px solid #e5e5e5; border-radius: 8px; }
  .step img { max-width: 100%; border: 1px solid #e5e5e5; border-radius: 6px; margin-top: 4px; }
  ul.errors { margin: 8px 0 0; padding-left: 18px; }
  ul.errors li { color: #b00020; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>${esc(meta.title || "Bug report")}</h1>
  <div class="meta">${metaBits.map((b) => `<span>${b}</span>`).join("")}</div>
  ${meta.description ? `<div class="description">${esc(meta.description)}</div>` : ""}
  <h2>Steps to reproduce (${session.steps.length})</h2>
  ${stepsHtml}
  ${issuesHtml}
  <script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 150); });</script>
</body>
</html>`;
}

/** Opens a print window so the browser can save the report as a PDF. */
export function printReportAsPdf(report: Report): void {
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Couldn't open the print window — allow pop-ups for this site.");
  }
  win.document.open();
  win.document.write(buildReportHtml(report));
  win.document.close();
}
