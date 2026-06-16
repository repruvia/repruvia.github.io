// Domain model
export * from "./types/domain.js";
export * from "./types/messaging.js";

// Pure logic
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
export { relativeTime, isoFromMs } from "./logic/time.js";
export { uuid } from "./logic/id.js";

// Integration contracts
export * from "./integrations/ticketProvider.js";

// Constants
export * from "./constants.js";
