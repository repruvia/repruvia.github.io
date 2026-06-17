import { ChevronDown, Clipboard, Copy, Download, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinearIcon, JiraIcon } from "@/components/atoms/BrandIcons";
import type { ProviderId } from "@/lib/integrations/providerRegistry";
import type { ReportActions } from "@/hooks/useReportActions";

interface SubmitBarProps {
  actions: ReportActions;
  onSubmit: (providerId: ProviderId) => void;
}

/** Sticky action bar: each button opens a menu of options that run on click. */
export function SubmitBar({ actions, onSubmit }: SubmitBarProps) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card/80 p-3 backdrop-blur">
      <Menu
        label="Export"
        icon={<Download />}
        variant="outline"
        items={[
          { icon: <FileText />, label: "PDF", onSelect: actions.exportPdf },
          { icon: <FileText />, label: "Markdown", onSelect: actions.exportMarkdown },
        ]}
      />
      <Menu
        label="Copy"
        icon={<Copy />}
        variant="outline"
        items={[
          { icon: <Clipboard />, label: "Markdown", onSelect: actions.copyMarkdown },
          { icon: <Clipboard />, label: "Raw text", onSelect: actions.copyText },
        ]}
      />
      <Menu
        label="Raise an issue"
        icon={<Send />}
        variant="default"
        items={[
          { icon: <LinearIcon className="size-4" />, label: "Linear", onSelect: () => onSubmit("linear") },
          { icon: <JiraIcon className="size-4" />, label: "Jira", onSelect: () => onSubmit("jira") },
        ]}
      />
    </div>
  );
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}

interface MenuProps {
  label: string;
  icon: React.ReactNode;
  variant: "outline" | "default";
  items: MenuItem[];
}

function Menu({ label, icon, variant, items }: MenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant}>
          {icon} {label} <ChevronDown className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            {item.icon} {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
