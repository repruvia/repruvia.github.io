/** Minimal chat message shape (OpenAI-compatible, which WebLLM mirrors). */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Model-download / initialization progress. */
export interface LlmProgress {
  /** 0–1. */
  progress: number;
  text: string;
}

export interface GenerateOptions {
  /** Called with the full accumulated text on each streamed token. */
  onToken?: (full: string) => void;
  signal?: AbortSignal;
  /** Request a single JSON object (non-streamed) via the model's JSON mode. */
  json?: boolean;
  /**
   * JSON Schema to grammar-constrain the output. Required when `json` is set:
   * WebLLM's JSON mode compiles a schema natively, and omitting it makes the
   * binding pass `undefined` to a C++ string arg, which throws in the worker.
   */
  schema?: object;
}

/**
 * Abstraction over an LLM backend. The UI depends only on this interface, so the
 * in-browser WebLLM engine can later be swapped or joined by other backends
 * (e.g. a bring-your-own-key cloud model) without touching components/hooks.
 */
export interface LlmEngine {
  /** Whether this engine can run in the current environment. */
  isSupported(): Promise<boolean>;
  /** Load the model (idempotent). Reports download/compile progress. */
  init(onProgress?: (progress: LlmProgress) => void): Promise<void>;
  /** Stream a completion; resolves with the final text. */
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>;
}
