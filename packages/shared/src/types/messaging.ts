/**
 * Typed message contracts for every channel. Discriminated unions give
 * exhaustive, compile-time-checked handling on both ends of each channel.
 */

import type {
  RepruviaSession,
  ConsoleEntry,
  DomEvent,
  NetworkFailure,
  ReactInfo,
  SessionSummary,
  Snapshot,
  SnapshotSummary,
} from "./domain.js";

/** Channel: page → content script (window.postMessage from injected hooks). */
export type PageMessage =
  | { source: "repruvia"; kind: "console"; level: "error" | "warn"; message: string; timestamp: number }
  | { source: "repruvia"; kind: "network"; url: string; method: string; status: number; timestamp: number }
  | { source: "repruvia"; kind: "react"; xpath: string; info: ReactInfo | null };

/** Channel: content script → service worker. */
export type CaptureMessage =
  | { type: "CAPTURE_EVENT"; event: DomEvent }
  | { type: "CAPTURE_CONSOLE"; entry: Omit<ConsoleEntry, "id" | "nearestStepId"> }
  | { type: "CAPTURE_NETWORK"; failure: Omit<NetworkFailure, "id" | "nearestStepId"> }
  | { type: "CAPTURE_REACT"; xpath: string; info: ReactInfo; timestamp: number };

/** A drag-selected region from the snip overlay, in CSS pixels within the viewport. */
export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Channel: snip overlay content script → service worker. */
export type SnapshotMessage =
  | { type: "CAPTURE_REGION"; rect: CaptureRect; devicePixelRatio: number }
  | { type: "CANCEL_SNAPSHOT" };

/** Channel: service worker → content script (the snip overlay command). */
export type TabCommand =
  | { type: "TOGGLE_CAPTURE"; active: boolean }
  | { type: "BEGIN_SNAPSHOT" };

/** Channel: popup → service worker (control plane). */
export type ControlMessage =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "GET_RECORDING_STATE" }
  | { type: "START_SNAPSHOT" };

/** Result of asking the extension to begin a region snip in the active tab. */
export interface SnapshotStartResult {
  ok: boolean;
  error?: string;
}

/** Channel: web app → extension (`chrome.runtime.sendMessage` external). */
export type ExternalRequest =
  | { type: "GET_SESSION"; sessionId: string }
  | { type: "LIST_SESSIONS" }
  | { type: "DELETE_SESSION"; sessionId: string }
  | { type: "GET_SNAPSHOT"; snapshotId: string }
  | { type: "LIST_SNAPSHOTS" }
  | { type: "DELETE_SNAPSHOT"; snapshotId: string }
  /**
   * Run a cross-origin request from the extension service worker, which (with
   * `host_permissions`) bypasses the page's CORS — needed to upload ticket
   * screenshots to provider storage (e.g. Linear's `uploads.linear.app`) that
   * rejects browser-origin PUTs. `body` is base64 so it survives JSON messaging.
   */
  | {
      type: "PROXY_FETCH";
      url: string;
      method: string;
      headers: Record<string, string>;
      bodyBase64?: string;
    };

/** Responses to `ExternalRequest`. */
export type ExternalResponse =
  | { ok: true; type: "GET_SESSION"; session: RepruviaSession | null }
  | { ok: true; type: "LIST_SESSIONS"; sessions: SessionSummary[] }
  | { ok: true; type: "DELETE_SESSION" }
  | { ok: true; type: "GET_SNAPSHOT"; snapshot: Snapshot | null }
  | { ok: true; type: "LIST_SNAPSHOTS"; snapshots: SnapshotSummary[] }
  | { ok: true; type: "DELETE_SNAPSHOT" }
  | { ok: true; type: "PROXY_FETCH"; status: number; statusText: string; bodyText: string }
  | { ok: false; error: string };

export type RecordingState = "idle" | "recording";

export interface RecordingStatePayload {
  state: RecordingState;
  sessionId: string | null;
  stepCount: number;
}
