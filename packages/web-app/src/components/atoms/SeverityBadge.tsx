import { SEVERITY_LABELS, type Severity } from "@repruvia/shared";
import { Badge } from "@/components/ui/badge";

const VARIANT: Record<Severity, "secondary" | "default" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "default",
  critical: "destructive",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant={VARIANT[severity]}>{SEVERITY_LABELS[severity]}</Badge>;
}
