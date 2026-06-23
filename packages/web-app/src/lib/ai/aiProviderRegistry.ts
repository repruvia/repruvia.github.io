import { isAiConfigured, type AppSettings } from "@/lib/settings";
import type { LlmEngine } from "./types";
import { webLlmEngine } from "./webLlmEngine";
import { OpenAiCompatibleEngine } from "./providers/openaiProvider";
import { AnthropicEngine } from "./providers/anthropicProvider";
import { GeminiEngine } from "./providers/geminiProvider";

/** The active AI engine for the user's settings, or null when AI is off/unconfigured. */
export function buildActiveEngine(settings: AppSettings): LlmEngine | null {
  if (!isAiConfigured(settings)) return null;
  const { activeProvider, providers } = settings.ai;
  switch (activeProvider) {
    case "webllm":
      return webLlmEngine; // model is read from settings inside the engine
    case "openai":
      return new OpenAiCompatibleEngine({
        baseUrl: "https://api.openai.com/v1",
        apiKey: providers.openai.apiKey ?? "",
        model: providers.openai.model,
      });
    case "grok":
      return new OpenAiCompatibleEngine({
        baseUrl: "https://api.x.ai/v1",
        apiKey: providers.grok.apiKey ?? "",
        model: providers.grok.model,
      });
    case "anthropic":
      return new AnthropicEngine({
        apiKey: providers.anthropic.apiKey ?? "",
        model: providers.anthropic.model,
      });
    case "gemini":
      return new GeminiEngine({
        apiKey: providers.gemini.apiKey ?? "",
        model: providers.gemini.model,
      });
    default:
      return null;
  }
}

/** Whether the active provider can accept images (gates sending screenshots). */
export function isVisionProvider(settings: AppSettings): boolean {
  const id = settings.ai.activeProvider;
  if (!id) return false;
  if (id === "webllm") return /vision/i.test(settings.ai.providers.webllm.model);
  return true; // the cloud defaults are all vision-capable
}
