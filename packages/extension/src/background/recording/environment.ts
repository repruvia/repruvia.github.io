import { isoFromMs, type Environment } from "@repruvia/shared";

/** Values read from inside the page (the service worker has no `window`). */
interface PageEnv {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  userAgent: string;
}

function readPageEnv(): PageEnv {
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
  };
}

function parseBrowser(userAgent: string): { name: string; version: string } {
  const chrome = /Chrome\/([\d.]+)/.exec(userAgent);
  if (chrome) return { name: "Chrome", version: chrome[1] ?? "" };
  const firefox = /Firefox\/([\d.]+)/.exec(userAgent);
  if (firefox) return { name: "Firefox", version: firefox[1] ?? "" };
  return { name: "Unknown", version: "" };
}

function parseOs(userAgent: string): string {
  if (userAgent.includes("Mac")) return "macOS";
  if (userAgent.includes("Win")) return "Windows";
  if (userAgent.includes("Linux")) return "Linux";
  return "Unknown";
}

/** Capture the full `Environment` for a tab at recording start (PRD §10). */
export async function captureEnvironment(tabId: number, url: string): Promise<Environment> {
  let page: PageEnv = {
    viewportWidth: 0,
    viewportHeight: 0,
    devicePixelRatio: 1,
    userAgent: navigator.userAgent,
  };
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: readPageEnv,
    });
    if (result?.result) page = result.result as PageEnv;
  } catch {
    // Restricted page (chrome://, web store) — fall back to SW navigator values.
  }

  const browser = parseBrowser(page.userAgent);
  return {
    url,
    browserName: browser.name,
    browserVersion: browser.version,
    os: parseOs(page.userAgent),
    viewportWidth: page.viewportWidth,
    viewportHeight: page.viewportHeight,
    devicePixelRatio: page.devicePixelRatio,
    userAgent: page.userAgent,
    recordingStartTime: isoFromMs(Date.now()),
  };
}
