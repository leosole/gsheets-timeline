import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./index.css";
import { devMockHeaders, devMockRows } from "./utils/dev-mock-data";
import { isHosted } from "./utils/sheet-host";

// Local dev convenience: provide default rows/headers when running outside Apps Script.
const isLocalRuntime =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

if (isLocalRuntime && !isHosted()) {
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
