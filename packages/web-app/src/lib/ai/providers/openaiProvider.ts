import type { ChatMessage, GenerateOptions, LlmEngine } from "../types";
import { partsOf } from "../types";
import { proxyJson } from "./proxyJson";

interface OpenAiConfig {
  /** e.g. https://api.openai.com/v1 or https://api.x.ai/v1 */
  baseUrl: string;
  apiKey: string;
  model: string;
}

function toOpenAiContent(content: ChatMessage["content"]) {
  if (typeof content === "string") return content;
  return partsOf(content).map((p) =>
    p.type === "text"
      ? { type: "text", text: p.text }
      : { type: "image_url", image_url: { url: p.dataUrl } },
  );
}

/** OpenAI Chat Completions API; also serves xAI Grok (same wire format). */
export class OpenAiCompatibleEngine implements LlmEngine {
  constructor(private config: OpenAiConfig) {}

  isSupported(): Promise<boolean> {
    return Promise.resolve(true);
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async generate(messages: ChatMessage[], _options: GenerateOptions = {}): Promise<string> {
    const body = {
      model: this.config.model,
      temperature: 0.4,
      max_tokens: 1024,
      messages: messages.map((m) => ({ role: m.role, content: toOpenAiContent(m.content) })),
    };
    const data = (await proxyJson(
      `${this.config.baseUrl}/chat/completions`,
      { authorization: `Bearer ${this.config.apiKey}` },
      body,
    )) as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content ?? "").trim();
  }
}
