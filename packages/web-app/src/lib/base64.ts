/** Encode a Blob as base64 (no data-URL prefix) for JSON messaging. */
export function blobToBase64(blob: Blob): Promise<string> {
  // FileReader encodes natively — far faster than building a binary string for multi-MB screenshots.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file."));
    reader.readAsDataURL(blob);
  });
}
