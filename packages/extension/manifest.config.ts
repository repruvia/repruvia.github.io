import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json" with { type: "json" };

/**
 * MV3 manifest. Two content scripts run in different execution worlds:
 *  - ISOLATED (`content/index.ts`): DOM event capture + message relay. Safe,
 *    sandboxed from the page.
 *  - MAIN (`content/inpage.ts`): console/fetch/XHR interceptors and the React
 *    fiber reader. These MUST run in the page's own world to override the
 *    page's `console`/`fetch` and read `__REACT_DEVTOOLS_GLOBAL_HOOK__`.
 */
export default defineManifest({
  manifest_version: 3,
  name: "Repruvia",
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: "116",
  icons: {
    "16": "src/assets/icon-16.png",
    "48": "src/assets/icon-48.png",
    "128": "src/assets/icon-128.png",
  },
  permissions: ["activeTab", "scripting", "storage", "unlimitedStorage", "tabs"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
      world: "ISOLATED",
    },
    {
      matches: ["<all_urls>"],
      js: ["src/content/inpage.ts"],
      run_at: "document_start",
      world: "MAIN",
    },
    {
      // Self-identify to the Repruvia web app so it needs no extension-id config.
      matches: ["http://localhost:3000/*", "https://repruvia.app/*", "https://leoanimesh.github.io/*"],
      js: ["src/content/webappBridge.ts"],
      run_at: "document_start",
      world: "ISOLATED",
    },
  ],
  action: {
    default_popup: "src/popup/popup.html",
    default_title: "Repruvia",
    default_icon: {
      "16": "src/assets/icon-16.png",
      "48": "src/assets/icon-48.png",
      "128": "src/assets/icon-128.png",
    },
  },
  devtools_page: "src/devtools/devtools.html",
  // Allow the Repruvia web app to message the extension directly.
  externally_connectable: {
    matches: ["http://localhost:3000/*", "https://repruvia.app/*", "https://leoanimesh.github.io/*"],
  },
});
