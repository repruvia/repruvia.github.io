function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image."));
    img.src = src;
  });
}

/**
 * Downscale a PNG/JPEG data URL so its longest edge is at most `maxDim` (keeping
 * aspect ratio); returns the original if already in bounds or canvas is missing.
 * Used by the AI path to keep request payloads small and fast.
 */
export async function downscaleImage(dataUrl: string, maxDim: number): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    const longest = Math.max(img.width, img.height);
    if (longest <= maxDim) return dataUrl;
    const scale = maxDim / longest;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return dataUrl;
  }
}
