import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownText } from "@/components/atoms/MarkdownText";
import { cn } from "@/lib/utils";

interface InlineEditableProps {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Click-to-edit text. Presentational: it reports committed edits via `onCommit`
 * and holds only ephemeral draft state. All persistence lives in the store/hook.
 */
export function InlineEditable({ value, onCommit, ariaLabel, className }: InlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing) {
    return (
      <Textarea
        ref={ref}
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn("min-h-9 resize-none text-sm", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={cn(
        "group flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-accent",
        className,
      )}
    >
      <span className="min-w-0 flex-1 break-words">
        <MarkdownText>{value}</MarkdownText>
      </span>
      <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
