import { extensionBridge } from "@/lib/extensionBridge";

/** POST a JSON payload through the extension proxy and return the parsed body. */
export async function proxyJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
): Promise<unknown> {
  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const res = await extensionBridge.proxyFetch({
    url,
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`AI request failed (${res.status}). ${res.bodyText.slice(0, 300)}`);
  }
  try {
    return JSON.parse(res.bodyText);
  } catch {
    throw new Error("AI request returned a non-JSON response.");
  }
}
