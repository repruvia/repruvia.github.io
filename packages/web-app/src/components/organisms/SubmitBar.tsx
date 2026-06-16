import { Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProviderId } from "@/lib/integrations/providerRegistry";

interface SubmitBarProps {
  onSubmit: (providerId: ProviderId) => void;
  onExport: () => void;
}

/** Sticky action bar with the available submission targets. */
export function SubmitBar({ onSubmit, onExport }: SubmitBarProps) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card/80 p-3 backdrop-blur">
      <Button variant="outline" onClick={onExport}>
        <Download /> Export Markdown
      </Button>
      <Button variant="outline" onClick={() => onSubmit("jira")}>
        <Send /> Submit to Jira
      </Button>
      <Button onClick={() => onSubmit("linear")}>
        <Send /> Submit to Linear
      </Button>
    </div>
  );
}
