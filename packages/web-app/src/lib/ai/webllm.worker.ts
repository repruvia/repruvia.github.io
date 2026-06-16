/**
 * WebLLM web worker. All model compilation and inference run here so the main
 * thread (and the report UI) never blocks. The handler speaks WebLLM's own
 * message protocol; the main thread talks to it via `CreateWebWorkerMLCEngine`.
 */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (event: MessageEvent) => {
  handler.onmessage(event);
};
