import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface StateScreenProps {
  title: string;
  description?: string;
  loading?: boolean;
  action?: ReactNode;
}

/** Centered message used for loading / empty / error states. */
export function StateScreen({ title, description, loading, action }: StateScreenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      {loading && <Loader2 className="size-8 animate-spin text-muted-foreground" />}
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
