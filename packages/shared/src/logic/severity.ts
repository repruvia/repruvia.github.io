import type { Severity } from "../types/domain.js";

export const SEVERITIES: readonly Severity[] = ["low", "medium", "high", "critical"] as const;

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/** Linear uses 1=Urgent … 4=Low; 0=No priority. */
export function severityToLinearPriority(severity: Severity): number {
  switch (severity) {
    case "critical":
      return 1;
    case "high":
      return 2;
    case "medium":
      return 3;
    case "low":
      return 4;
  }
}

/** Jira priority names (default scheme). */
export function severityToJiraPriority(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "Highest";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
  }
}
