/**
 * Where to open the web app. An explicit `VITE_WEB_APP_URL` always wins;
 * otherwise the local web app for dev builds and the live GitHub Pages site for
 * production builds (what ships to the Chrome Web Store). Gate on MODE, not
 * `import.meta.env.DEV` — the latter is false for ANY `vite build` (even the
 * `--mode development` watch build the extension's `dev` script uses).
 */
export const WEB_APP_URL =
  import.meta.env.VITE_WEB_APP_URL ??
  (import.meta.env.MODE === "production" ? "https://repruvia.github.io" : "http://localhost:3000");

/** Open a fresh tab on the web app with the given query string (e.g. `?session=…`). */
export async function openWebApp(query: string): Promise<void> {
  await chrome.tabs.create({ url: `${WEB_APP_URL}/?${query}` });
}
