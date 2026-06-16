/** Trigger a browser download of a Blob. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Trigger a browser download of text content as a file. */
export function downloadTextFile(filename: string, content: string, mime = "text/markdown"): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}
