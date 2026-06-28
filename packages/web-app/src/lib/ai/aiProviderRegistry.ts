import { isAiConfigured, type AppSettings } from "@/lib/settings";
import type { LlmEngine } from "./types";
import { OpenAiCompatibleEngine } from "./providers/openaiProvider";
import { AnthropicEngine } from "./providers/anthropicProvider";
import { GeminiEngine } from "./providers/geminiProvider";

/** The active AI engine for the user's settings, or null when AI is off/unconfigured. */
export function buildActiveEngine(settings: AppSettings): LlmEngine | null {
  if (!isAiConfigured(settings)) return null;
  const { activeProvider, providers } = settings.ai;
  switch (activeProvider) {
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
    case "groq":
      return new OpenAiCompatibleEngine({
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: providers.groq.apiKey ?? "",
        model: providers.groq.model,
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
  // All supported providers' listed models accept image input.
  return settings.ai.activeProvider !== null;
}
