import { SEVERITIES, SEVERITY_LABELS, type Severity } from "@repruvia/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SeveritySelectProps {
  value: Severity;
  onChange: (severity: Severity) => void;
}

export function SeveritySelect({ value, onChange }: SeveritySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Severity)}>
      <SelectTrigger className="w-40" aria-label="Severity">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SEVERITIES.map((severity) => (
          <SelectItem key={severity} value={severity}>
            {SEVERITY_LABELS[severity]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
