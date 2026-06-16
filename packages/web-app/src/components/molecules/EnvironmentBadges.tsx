import type { Environment } from "@repruvia/shared";
import { MetaBadge } from "@/components/atoms/MetaBadge";

export function EnvironmentBadges({ environment }: { environment: Environment }) {
  return (
    <div className="flex flex-wrap gap-2">
      <MetaBadge label="URL" value={environment.url || "—"} />
      <MetaBadge label="Browser" value={`${environment.browserName} ${environment.browserVersion}`} />
      <MetaBadge label="OS" value={environment.os} />
      <MetaBadge
        label="Viewport"
        value={`${environment.viewportWidth}×${environment.viewportHeight}`}
      />
    </div>
  );
}
