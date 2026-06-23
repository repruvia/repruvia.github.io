import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAiRefine } from "@/hooks/aiRefine";
import type { RefineField } from "@/lib/ai/reportPrompt";
import { cn } from "@/lib/utils";

interface AiRefineButtonProps {
  field: RefineField;
  /** Current text to refine. */
  text: string;
  /** Apply the refined text. */
  onResult: (next: string) => void;
  label?: string;
  className?: string;
}

/**
 * Inline "refine with AI" icon for a single field. Renders nothing when on-device
 * AI is unavailable; shows a spinner while the model runs. The actual model
 * loading/inference lives in the `AiRefineProvider`.
 */
export function AiRefineButton({ field, text, onResult, label, className }: AiRefineButtonProps) {
  const { available, refine } = useAiRefine();
  const [pending, setPending] = useState(false);

  if (!available) return null;

  const title = label ?? `Refine ${field} with AI`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={title}
      title={title}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          onResult(await refine(field, text));
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setPending(false);
        }
      }}
      className={cn("size-7 text-muted-foreground hover:text-primary", className)}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
    </Button>
  );
}
