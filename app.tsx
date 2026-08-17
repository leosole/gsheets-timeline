import React, { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { SettingsPanel } from "./components/SettingsPanel";
import { Timeline } from "./components/Timeline";
import {
  buildFieldOptions,
  resolveTimelineLayout,
  sanitizeSpreadsheetData,
  type SpreadsheetConfig,
} from "./utils/sheetConfig";
import {
  getSheetPayload,
  getSheetRows,
  getWindowConfig,
  getWindowData,
  getWindowHeaders,
} from "./utils/sheetHost";

type TabName = "timeline" | "settings";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>(() =>
    resolveTimelineLayout((window as any).__TIMELINE_MODE__) === "timeline"
      ? "timeline"
      : "settings",
  );
  const [config, setConfig] = useState<SpreadsheetConfig>(() =>
    getWindowConfig(),
  );
  const [rows, setRows] = useState<any[]>(() => getWindowData());
  const [headers, setHeaders] = useState<string[]>(() => getWindowHeaders());

  function update() {
    getSheetRows().then((latestRows) => {
      setRows(latestRows);
      window.__TIMELINE_DATA__ = latestRows;
    });
  }
  useEffect(() => {
    const hasInjectedState =
      Array.isArray(window.__TIMELINE_DATA__) || !!window.__TIMELINE_CONFIG__;

    const appsScriptGoogle = (globalThis as any).google;

    if (
      !hasInjectedState &&
      appsScriptGoogle &&
      appsScriptGoogle.script &&
      appsScriptGoogle.script.run
    ) {
      getSheetPayload().then(({ rows, headers, config }) => {
        setRows(rows);
        setHeaders(headers);
        setConfig(config);
      });
      return;
    }

    setRows(getWindowData());
    setHeaders(getWindowHeaders());
    setConfig(getWindowConfig());
  }, []);

  useEffect(() => {
    window.__TIMELINE_CONFIG__ = config;
  }, [config]);

  useEffect(() => {
    window.__TIMELINE_HEADERS__ = headers;
  }, [headers]);

  useEffect(() => {
    const mode = resolveTimelineLayout((window as any).__TIMELINE_MODE__);
    if (mode === "timeline") {
      setActiveTab("timeline");
      return;
    }
    setActiveTab("settings");
  }, []);

  const fieldOptions = useMemo(
    () => buildFieldOptions(rows, headers),
    [rows, headers],
  );

  const metadataFields = useMemo(() => {
    const coreFields = new Set<string>(
      [
        config.fieldMap.name,
        config.fieldMap.start,
        config.fieldMap.end,
        config.fieldMap.due,
        config.statusField || "",
      ].filter(Boolean),
    );

    return fieldOptions.filter((option) => !coreFields.has(option));
  }, [fieldOptions, config.fieldMap, config.statusField]);

  const tasks = useMemo(
    () => sanitizeSpreadsheetData(rows, config.fieldMap),
    [rows, config.fieldMap],
  );

  const [dark, setDark] = useState(() => {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("timeline-dark");
      if (stored !== null) return stored === "true";
    }
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("timeline-dark", String(dark));
  }, [dark]);

  const toggleDark = () => setDark((d) => !d);

  return (
    <div
      className="h-full min-h-0 bg-background text-foreground"
      style={{ resize: "both", overflow: "auto" }}
    >
      <AppHeader
        activeTab={activeTab}
        dark={dark}
        onTabChange={setActiveTab}
        onDarkModeToggle={toggleDark}
        onSync={update}
      />

      {activeTab === "timeline" ? (
        <>
          {tasks.length > 0 ? (
            <Timeline
              tasks={tasks}
              title={config.title}
              filterFields={config.filterFields}
              popupFields={config.popupFields}
              sheetUrl={config.sheetUrl}
              statusField={config.statusField}
            />
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center p-8 text-center">
              <div className="max-w-md rounded-lg border border-dashed border-border bg-card p-6">
                <h2 className="text-lg font-semibold">
                  No spreadsheet rows loaded
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open the Configuration tab, map the date columns, and click
                  Update to sync the spreadsheet data.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <SettingsPanel
          config={config}
          fieldOptions={fieldOptions}
          metadataFields={metadataFields}
          onConfigChange={setConfig}
        />
      )}
    </div>
  );
};

export default App;
