import type { ChatMessage, GenerateOptions, LlmEngine } from "../types";
import { dataUrlToBase64, partsOf, textOf } from "../types";
import { proxyJson } from "./proxyJson";

function toAnthropicContent(content: ChatMessage["content"]) {
  return partsOf(content).map((p) => {
    if (p.type === "text") return { type: "text", text: p.text };
    const { mediaType, base64 } = dataUrlToBase64(p.dataUrl);
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  });
}

export class AnthropicEngine implements LlmEngine {
  constructor(private config: { apiKey: string; model: string }) {}

  isSupported(): Promise<boolean> {
    return Promise.resolve(true);
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async generate(messages: ChatMessage[], _options: GenerateOptions = {}): Promise<string> {
    // Anthropic takes `system` at the top level, not as a message.
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => textOf(m.content))
      .join("\n");
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) }));

    const data = (await proxyJson(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      { model: this.config.model, max_tokens: 1024, system, messages: turns },
    )) as { content?: { type: string; text?: string }[] };
    return (data.content?.find((c) => c.type === "text")?.text ?? "").trim();
  }
}
