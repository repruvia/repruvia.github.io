import {
  deviceCropRect,
  SNAPSHOT_QUERY_PARAM,
  uuid,
  type CaptureRect,
  type Snapshot,
  type SnapshotMessage,
  type SnapshotStartResult,
  type TabCommand,
} from "@repruvia/shared";
import type { SnapshotRepository } from "../storage/types.js";
import { openWebApp } from "./webAppUrl.js";

/**
 * Owns the "snip" lifecycle: drives the overlay, performs the visible-tab
 * capture + crop, and opens the annotation editor.
 */
export class SnapshotController {
  constructor(private readonly snapshots: SnapshotRepository) {}

  /** Ask the active tab's content script to show the drag-select overlay. */
  async begin(tab: chrome.tabs.Tab): Promise<SnapshotStartResult> {
    if (tab.id === undefined) return { ok: false, error: "No active tab." };
    try {
      const command: TabCommand = { type: "BEGIN_SNAPSHOT" };
      await chrome.tabs.sendMessage(tab.id, command);
      return { ok: true };
    } catch {
      // Same caveat as recording: a restricted page (chrome://, Web Store) or a
      // tab opened before the extension loaded has no content script.
      return {
        ok: false,
        error: "Can't snip this page. Reload it (or try a normal web page) and snip again.",
      };
    }
  }

  /** Handle a region selection (or cancellation) from the overlay. */
  async handle(message: SnapshotMessage, sender: chrome.runtime.MessageSender): Promise<void> {
    if (message.type === "CANCEL_SNAPSHOT") return;
    const windowId = sender.tab?.windowId;
    if (windowId === undefined) return;
    await this.capture(windowId, sender.tab?.url ?? "", message.rect, message.devicePixelRatio);
  }

  private async capture(
    windowId: number,
    tabUrl: string,
    rect: CaptureRect,
    devicePixelRatio: number,
  ): Promise<void> {
    const fullDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    if (!fullDataUrl) return;

    const image = await cropDataUrl(fullDataUrl, rect, devicePixelRatio);

    const snapshot: Snapshot = {
      id: uuid(),
      createdAt: Date.now(),
      tabUrl,
      image: image.dataUrl,
      width: image.width,
      height: image.height,
    };
    await this.snapshots.save(snapshot);
    await openWebApp(`${SNAPSHOT_QUERY_PARAM}=${encodeURIComponent(snapshot.id)}`);
  }
}

/** Crop a captured-viewport PNG data URL down to the selected region. */
async function cropDataUrl(
  fullDataUrl: string,
  rect: CaptureRect,
  devicePixelRatio: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const sourceBlob = await (await fetch(fullDataUrl)).blob();
  const bitmap = await createImageBitmap(sourceBlob);
  const crop = deviceCropRect(rect, devicePixelRatio, bitmap.width, bitmap.height);

  const canvas = new OffscreenCanvas(crop.width, crop.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
  ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  bitmap.close();

  const outBlob = await canvas.convertToBlob({ type: "image/png" });
  const dataUrl = await blobToDataUrl(outBlob);
  return { dataUrl, width: crop.width, height: crop.height };
}

/** Service workers have no FileReader, so build the data URL from the raw bytes. */
async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}
