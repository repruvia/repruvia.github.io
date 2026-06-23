import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Report } from "@repruvia/shared";
import { webLlmEngine } from "@/lib/ai/webLlmEngine";
import { buildFieldRefineMessages, formatStepMarkdown, type RefineField } from "@/lib/ai/reportPrompt";
import { loadSettings } from "@/lib/settings";

interface AiRefineContextValue {
  /** AI is on in Settings and the browser supports WebGPU. */
  available: boolean;
  /** Refine a single field's text with the on-device model. */
  refine: (field: RefineField, current: string) => Promise<string>;
}

const AiRefineContext = createContext<AiRefineContextValue | null>(null);
const MODEL_TOAST_ID = "ai-refine-model";

/**
 * Shares on-device AI availability + a per-field `refine()` across all the
 * inline refine buttons, so the (singleton) model is detected once and loaded
 * lazily on first use, with progress surfaced as a toast. Behaviour lives here;
 * the buttons are presentational.
 */
export function AiRefineProvider({ report, children }: { report: Report | null; children: ReactNode }) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    let active = true;
    void webLlmEngine.isSupported().then((s) => active && setSupported(s));
    return () => {
      active = false;
    };
  }, []);

  const available = supported && loadSettings().aiEnabled;

  const refine = useCallback(
    async (field: RefineField, current: string): Promise<string> => {
      if (!report) throw new Error("No report loaded.");

      // Lazy model load (first use only); show download/compile progress.
      let showedProgress = false;
      await webLlmEngine.init((p) => {
        showedProgress = true;
        toast.loading(`Loading AI model… ${Math.round(p.progress * 100)}%`, { id: MODEL_TOAST_ID });
      });
      if (showedProgress) toast.dismiss(MODEL_TOAST_ID);

      const out = (await webLlmEngine.generate(buildFieldRefineMessages(field, current, report))).trim();
      if (!out) throw new Error("The model returned nothing. Try again.");
      return field === "step" ? formatStepMarkdown(out) : out;
    },
    [report],
  );

  return <AiRefineContext.Provider value={{ available, refine }}>{children}</AiRefineContext.Provider>;
}

export function useAiRefine(): AiRefineContextValue {
  return (
    useContext(AiRefineContext) ?? {
      available: false,
      refine: async () => {
        throw new Error("AiRefineProvider is missing.");
      },
    }
  );
}
