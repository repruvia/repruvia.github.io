import type { ReactInfo } from "@repruvia/shared";
import { Badge } from "@/components/ui/badge";

export function ReactComponentBadge({ info }: { info: ReactInfo }) {
  const props = Object.entries(info.props);
  return (
    <Badge variant="secondary" className="max-w-full gap-1.5 font-mono text-xs">
      <span aria-hidden>⚛</span>
      <span className="font-semibold">{`<${info.name}>`}</span>
      {props.length > 0 && (
        <span className="truncate text-muted-foreground">
          {props.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")}
        </span>
      )}
    </Badge>
  );
}
