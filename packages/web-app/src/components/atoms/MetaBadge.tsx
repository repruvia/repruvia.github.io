import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** A labeled key/value badge used for environment facts. */
export function MetaBadge({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </Badge>
  );
}
