/** Decode a base64 data URL into raw bytes (backed by a fresh ArrayBuffer). */
export function dataUrlToBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Decode a base64 data URL into a Blob, preserving its MIME type. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const header = dataUrl.split(",")[0] ?? "";
  const mime = /data:(.*?);base64/.exec(header)?.[1] ?? "image/png";
  return new Blob([dataUrlToBytes(dataUrl)], { type: mime });
}
