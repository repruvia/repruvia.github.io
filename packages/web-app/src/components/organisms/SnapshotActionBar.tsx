import type { ReactNode } from "react";
import {
  ChevronDown,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinearIcon, JiraIcon } from "@/components/atoms/BrandIcons";
import type { ProviderId } from "@/lib/integrations/providerRegistry";
import type { CreatedTicket } from "@/lib/ticketPersistence";

interface SnapshotActionBarProps {
  onCopyImage: () => void;
  onCopyMarkdown: () => void;
  onDownloadPng: () => void;
  onDownloadMarkdown: () => void;
  onSubmit: (providerId: ProviderId) => void;
  createdTicket?: CreatedTicket | null;
}

/** Copy / Download / Raise-an-issue actions for the snip annotator (mirrors SubmitBar). */
export function SnapshotActionBar({
  onCopyImage,
  onCopyMarkdown,
  onDownloadPng,
  onDownloadMarkdown,
  onSubmit,
  createdTicket,
}: SnapshotActionBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Menu
        label="Copy"
        icon={<Copy />}
        variant="outline"
        items={[
          { icon: <ImageIcon />, label: "Image", onSelect: onCopyImage },
          { icon: <Clipboard />, label: "Markdown", onSelect: onCopyMarkdown },
        ]}
      />
      <Menu
        label="Download"
        icon={<Download />}
        variant="outline"
        items={[
          { icon: <ImageIcon />, label: "PNG", onSelect: onDownloadPng },
          { icon: <FileText />, label: "Markdown", onSelect: onDownloadMarkdown },
        ]}
      />
      {createdTicket ? (
        <Button asChild variant="default">
          <a href={createdTicket.url} target="_blank" rel="noreferrer">
            <ExternalLink /> View {createdTicket.identifier}
          </a>
        </Button>
      ) : (
        <Menu
          label="Raise an issue"
          icon={<Send />}
          variant="default"
          items={[
            { icon: <LinearIcon className="size-4" />, label: "Linear", onSelect: () => onSubmit("linear") },
            { icon: <JiraIcon className="size-4" />, label: "Jira", onSelect: () => onSubmit("jira") },
          ]}
        />
      )}
    </div>
  );
}

interface MenuItem {
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}

function Menu({
  label,
  icon,
  variant,
  items,
}: {
  label: string;
  icon: ReactNode;
  variant: "outline" | "default";
  items: MenuItem[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm">
          {icon} {label} <ChevronDown className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
            {item.icon} {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
