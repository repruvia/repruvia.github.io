import type { ChatMessage, GenerateOptions, LlmEngine } from "../types";
import { dataUrlToBase64, partsOf, textOf } from "../types";
import { proxyJson } from "./proxyJson";

function toGeminiParts(content: ChatMessage["content"]) {
  return partsOf(content).map((p) => {
    if (p.type === "text") return { text: p.text };
    const { mediaType, base64 } = dataUrlToBase64(p.dataUrl);
    return { inlineData: { mimeType: mediaType, data: base64 } };
  });
}

export class GeminiEngine implements LlmEngine {
  constructor(private config: { apiKey: string; model: string }) {}

  isSupported(): Promise<boolean> {
    return Promise.resolve(true);
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  async generate(messages: ChatMessage[], _options: GenerateOptions = {}): Promise<string> {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => textOf(m.content))
      .join("\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: toGeminiParts(m.content),
      }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const data = (await proxyJson(url, {}, {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
    })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return (data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
  }
}
