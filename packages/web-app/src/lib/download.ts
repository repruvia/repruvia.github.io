export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  // Firefox only follows clicks on attached anchors.
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download before the browser reads
  // the blob (large Markdown exports) — give it a moment.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadTextFile(filename: string, content: string, mime = "text/markdown"): void {
  downloadBlob(filename, new Blob([content], { type: mime }));
}
