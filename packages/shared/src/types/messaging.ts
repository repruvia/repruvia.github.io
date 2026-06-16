/**
 * Typed message contracts for every communication channel in Repruvia.
 *
 * Using discriminated unions here gives us exhaustive, compile-time-checked
 * handling on both ends of each channel — content script ↔ service worker and
 * web app ↔ extension.
 */

import type {
  RepruviaSession,
  ConsoleEntry,
  DomEvent,
  NetworkFailure,
  ReactInfo,
  SessionSummary,
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

/** Channel: popup → service worker (control plane). */
export type ControlMessage =
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "GET_RECORDING_STATE" };

/** Channel: web app → extension (`chrome.runtime.sendMessage` external). */
export type ExternalRequest =
  | { type: "GET_SESSION"; sessionId: string }
  | { type: "LIST_SESSIONS" }
  | { type: "DELETE_SESSION"; sessionId: string };

/** Responses to `ExternalRequest`. */
export type ExternalResponse =
  | { ok: true; type: "GET_SESSION"; session: RepruviaSession | null }
  | { ok: true; type: "LIST_SESSIONS"; sessions: SessionSummary[] }
  | { ok: true; type: "DELETE_SESSION" }
  | { ok: false; error: string };

export type RecordingState = "idle" | "recording";

export interface RecordingStatePayload {
  state: RecordingState;
  sessionId: string | null;
  stepCount: number;
}
