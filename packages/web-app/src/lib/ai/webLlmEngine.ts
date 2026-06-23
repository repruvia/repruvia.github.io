import type {
  ChatCompletionMessageParam,
  InitProgressReport,
  MLCEngineInterface,
} from "@mlc-ai/web-llm";
import { loadSettings } from "@/lib/settings";
import { partsOf, textOf } from "./types";
import type { ChatMessage, GenerateOptions, LlmEngine, LlmProgress } from "./types";

/** WebLLM mirrors the OpenAI message shape; VLMs accept image_url, text models need strings. */
function toWebLlmMessages(messages: ChatMessage[], allowImages: boolean): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === "string") return { role: m.role, content: m.content };
    if (!allowImages) return { role: m.role, content: textOf(m.content) };
    return {
      role: m.role,
      content: partsOf(m.content).map((p) =>
        p.type === "text"
          ? { type: "text", text: p.text }
          : { type: "image_url", image_url: { url: p.dataUrl } },
      ),
    };
  }) as ChatCompletionMessageParam[];
}

function isVisionModel(model: string): boolean {
  return /vision/i.test(model);
}

/**
 * The primary model comes from the user's AI settings (default: a small ~0.9 GB
 * instruct model). We fall back to an f32 build on devices/drivers without
 * shader-f16 so the feature still works.
 */
function primaryModel(): string {
  return loadSettings().ai.providers.webllm.model || "Llama-3.2-1B-Instruct-q4f16_1-MLC";
}
const FALLBACK_MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

/** WebGPU feature detection without pulling in @webgpu/types. */
export async function isWebGpuAvailable(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch {
    return false;
  }
}

/**
 * In-browser LLM engine backed by WebLLM (WebGPU). The heavy library is loaded
 * via dynamic `import()` so it is code-split out of the initial bundle and only
 * fetched when the user actually asks for an AI draft.
 */
class WebLlmEngine implements LlmEngine {
  private engine: MLCEngineInterface | null = null;
  private initializing: Promise<MLCEngineInterface> | null = null;

  isSupported(): Promise<boolean> {
    return isWebGpuAvailable();
  }

  async init(onProgress?: (progress: LlmProgress) => void): Promise<void> {
    await this.ensure(onProgress);
  }

  async generate(messages: ChatMessage[], options: GenerateOptions = {}): Promise<string> {
    const engine = await this.ensure();

    // JSON mode: a single structured object, non-streamed. A schema is required
    // — WebLLM compiles it into a native grammar (constraining output so it
    // parses reliably even on a 1B model). Passing JSON mode WITHOUT a schema
    // throws a BindingError in the worker and hangs the call, so we only set
    // `response_format` when a (stringified) schema is provided.
    const wlMessages = toWebLlmMessages(messages, isVisionModel(primaryModel()));
    if (options.json) {
      const result = await engine.chat.completions.create({
        messages: wlMessages,
        temperature: 0.2,
        stream: false,
        ...(options.schema
          ? { response_format: { type: "json_object", schema: JSON.stringify(options.schema) } }
          : {}),
      });
      return (result.choices[0]?.message?.content ?? "").trim();
    }

    const stream = await engine.chat.completions.create({
      messages: wlMessages,
      temperature: 0.4,
      stream: true,
    });

    let text = "";
    for await (const chunk of stream) {
      if (options.signal?.aborted) break;
      text += chunk.choices[0]?.delta?.content ?? "";
      options.onToken?.(text);
    }
    return text.trim();
  }

  private ensure(onProgress?: (progress: LlmProgress) => void): Promise<MLCEngineInterface> {
    if (this.engine) return Promise.resolve(this.engine);
    if (this.initializing) return this.initializing;

    this.initializing = this.create(primaryModel(), onProgress)
      .catch(() => this.create(FALLBACK_MODEL, onProgress))
      .then((engine) => {
        this.engine = engine;
        return engine;
      })
      .finally(() => {
        this.initializing = null;
      });
    return this.initializing;
  }

  private async create(
    model: string,
    onProgress?: (progress: LlmProgress) => void,
  ): Promise<MLCEngineInterface> {
    const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
    const worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
    try {
      return await CreateWebWorkerMLCEngine(worker, model, {
        initProgressCallback: (report: InitProgressReport) =>
          onProgress?.({ progress: report.progress, text: report.text }),
      });
    } catch (error) {
      worker.terminate();
      throw error;
    }
  }
}

/** Shared singleton so the model is downloaded/compiled at most once per page. */
export const webLlmEngine: LlmEngine = new WebLlmEngine();
