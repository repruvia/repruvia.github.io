import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { hydrateSettings } from "./lib/settings";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

const render = () =>
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// Fill the settings cache from IndexedDB before first render so synchronous `loadSettings()` reads are correct.
hydrateSettings().finally(render);
