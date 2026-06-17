import type { ReactNode } from "react";

interface StateScreenProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Centered message used for empty / error states. */
export function StateScreen({ title, description, action }: StateScreenProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
