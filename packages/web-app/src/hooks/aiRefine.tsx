import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type { Report } from "@repruvia/shared";
import { buildActiveEngine, isVisionProvider } from "@/lib/ai/aiProviderRegistry";
import { buildFieldRefineMessages, formatStepMarkdown, type RefineField } from "@/lib/ai/reportPrompt";
import { isAiConfigured, loadSettings } from "@/lib/settings";
import { downscaleImage } from "@/lib/imageScale";

interface AiRefineContextValue {
  /** A configured active AI provider exists (and, for on-device, WebGPU works). */
  available: boolean;
  refine: (field: RefineField, current: string, screenshot?: string | null) => Promise<string>;
}

const AiRefineContext = createContext<AiRefineContextValue | null>(null);
const MODEL_TOAST_ID = "ai-refine-model";

/**
 * Shares AI availability + a per-field `refine()` across the inline refine
 * buttons. Cloud calls run through the provider engines (extension proxy);
 * on-device WebLLM loads lazily with a progress toast.
 */
export function AiRefineProvider({ report, children }: { report: Report | null; children: ReactNode }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(isAiConfigured(loadSettings()));
  }, []);

  // Read the report through a ref so `refine` (and the context value) stay
  // stable while the tester types — otherwise every refine button re-renders.
  const reportRef = useRef(report);
  reportRef.current = report;

  const refine = useCallback(
    async (field: RefineField, current: string, screenshot?: string | null): Promise<string> => {
      const report = reportRef.current;
      if (!report) throw new Error("No report loaded.");
      const settings = loadSettings();
      const engine = buildActiveEngine(settings);
      if (!engine) throw new Error("No AI is set up yet. Turn one on in Settings.");

      // Lazy model load (on-device, first use only); show progress.
      let showedProgress = false;
      await engine.init((p) => {
        showedProgress = true;
        toast.loading(`Loading AI model… ${Math.round(p.progress * 100)}%`, { id: MODEL_TOAST_ID });
      });
      if (showedProgress) toast.dismiss(MODEL_TOAST_ID);

      // Full-resolution retina PNGs are several MB; the model doesn't need that.
      const shot =
        field === "step" && screenshot && isVisionProvider(settings)
          ? await downscaleImage(screenshot, 1280)
          : null;
      const out = (await engine.generate(buildFieldRefineMessages(field, current, report, shot))).trim();
      if (!out) throw new Error("The AI didn't write anything. Try again.");
      return field === "step" ? formatStepMarkdown(out) : out;
    },
    [],
  );

  const value = useMemo(() => ({ available, refine }), [available, refine]);
  return <AiRefineContext.Provider value={value}>{children}</AiRefineContext.Provider>;
}

export function useAiRefine(): AiRefineContextValue {
  return (
    useContext(AiRefineContext) ?? {
      available: false,
      refine: async () => {
        throw new Error("AI isn't available here.");
      },
    }
  );
}
