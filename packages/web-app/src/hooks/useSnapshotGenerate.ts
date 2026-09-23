import { useCallback, useEffect, useState } from "react";
import { buildActiveEngine, isVisionProvider } from "@/lib/ai/aiProviderRegistry";
import { buildSnapshotFieldMessages } from "@/lib/ai/snapshotPrompt";
import { isAiConfigured, loadSettings } from "@/lib/settings";
import { downscaleImage } from "@/lib/imageScale";

export interface SnapshotDraft {
  title: string;
  description: string;
}

interface SnapshotGenerate {
  available: boolean;
  generating: boolean;
  generate: (image: string, current: SnapshotDraft) => Promise<SnapshotDraft>;
}

/**
 * AI drafting for the snip annotator. Mirrors `useAiRefine` but is standalone
 * (no report context) and gates on a *vision-capable* provider, since the only
 * grounding the model gets is the image itself.
 */
export function useSnapshotGenerate(): SnapshotGenerate {
  const [available, setAvailable] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const settings = loadSettings();
    setAvailable(isAiConfigured(settings) && isVisionProvider(settings));
  }, []);

  const generate = useCallback(
    async (image: string, current: SnapshotDraft): Promise<SnapshotDraft> => {
      const settings = loadSettings();
      if (!isVisionProvider(settings)) {
        throw new Error("Choose an AI that can read images in Settings to draft from a screenshot.");
      }
      const engine = buildActiveEngine(settings);
      if (!engine) throw new Error("No AI is set up yet. Turn one on in Settings.");

      setGenerating(true);
      try {
        await engine.init();

        // Shrink the image before inference to keep payloads small/fast.
        const prepared = await downscaleImage(image, 1280);

        // Independent requests — run them together instead of back to back.
        const [title, description] = await Promise.all([
          engine.generate(buildSnapshotFieldMessages("title", prepared, current.title)),
          engine.generate(buildSnapshotFieldMessages("description", prepared, current.description)),
        ]);

        return {
          title: title.trim() || current.title,
          description: description.trim() || current.description,
        };
      } finally {
        setGenerating(false);
      }
    },
    [],
  );

  return { available, generating, generate };
}
