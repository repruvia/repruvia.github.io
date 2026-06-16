/**
 * MAIN-world in-page script (runs at document_start). It installs the
 * page-context hooks that can only work inside the page's own JS realm:
 * console/network interception and the React fiber reader. All three forward
 * data to the ISOLATED content script via `window.postMessage`.
 */
import { installConsoleInterceptor } from "./inpage/consoleInterceptor.js";
import { installNetworkInterceptor } from "./inpage/networkInterceptor.js";
import { installReactBridge } from "./inpage/reactBridge.js";

installConsoleInterceptor();
installNetworkInterceptor();
installReactBridge();
