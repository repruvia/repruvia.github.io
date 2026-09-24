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
    // The status and body stay on `cause` for the console; the message stays plain.
    throw new Error(
      res.status === 401 || res.status === 403
        ? "The AI provider rejected your API key. Check it in Settings."
        : "The AI provider couldn't finish that request. Try again.",
      { cause: `${res.status} ${res.bodyText.slice(0, 300)}` },
    );
  }
  try {
    return JSON.parse(res.bodyText);
  } catch {
    throw new Error("The AI provider sent back an unexpected reply. Try again.");
  }
}
