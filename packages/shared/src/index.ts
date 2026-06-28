export * from "./types/domain.js";
export * from "./types/messaging.js";

export { generateDescription } from "./logic/descriptionGenerator.js";
export {
  SEVERITIES,
  SEVERITY_LABELS,
  severityToLinearPriority,
  severityToJiraPriority,
} from "./logic/severity.js";
export {
  resolveStepText,
  reindexSteps,
  assignNearestSteps,
  groupByStep,
  assembleSession,
  toSessionSummary,
} from "./logic/report.js";
export { exportReportToMarkdown } from "./logic/markdownExporter.js";
export type { MarkdownExportOptions } from "./logic/markdownExporter.js";
export { deviceCropRect, toSnapshotSummary } from "./logic/snapshot.js";
export type { PixelRect } from "./logic/snapshot.js";
export { relativeTime, isoFromMs } from "./logic/time.js";
export { uuid } from "./logic/id.js";

export * from "./integrations/ticketProvider.js";

export * from "./constants.js";
