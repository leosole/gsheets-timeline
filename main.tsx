import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./index.css";
import { devMockHeaders, devMockRows } from "./utils/dev-mock-data";
import { isHosted } from "./utils/sheet-host";

// ---------------------------------------------------------------------------
// Runtime mode detection
// ---------------------------------------------------------------------------

const isAppsScript =
  typeof window !== "undefined" && !!(window as any).google?.script;
const isLocalHost =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

// On Vercel (or any non-Apps-Script, non-localhost deployment), enable the
// serverless API mode so sheet data is fetched via /api/sheets instead of
// google.script.run or local mock data.
if (!isAppsScript && !isLocalHost) {
  (window as any).__TIMELINE_VERCEL__ = true;
}

// Local dev convenience: provide default rows/headers when running outside Apps Script.
if (isLocalHost && !isHosted()) {
  if (!Array.isArray(window.__TIMELINE_DATA__)) {
    window.__TIMELINE_DATA__ = devMockRows;
  }
  if (!Array.isArray(window.__TIMELINE_HEADERS__)) {
    window.__TIMELINE_HEADERS__ = devMockHeaders;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
