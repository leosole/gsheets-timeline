import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppHeader } from "./AppHeader";
import { SettingsPanel } from "./SettingsPanel";
import { Timeline } from "./Timeline";
import {
  buildFieldOptions,
  sanitizeSpreadsheetData,
  DEFAULT_SPREADSHEET_CONFIG,
  type SpreadsheetConfig,
} from "../utils/sheetConfig";
import { fetchSheetRows, fetchSheetState } from "../utils/sheetHost";
import {
  getDefaultTabLabel,
  type SheetSelection,
  type TimelineTab,
} from "../utils/workspace";

export type ViewMode = "timeline" | "settings";

interface TimelineTabViewProps {
  tab: TimelineTab;
  dark: boolean;
  allowPicker: boolean;
  onDarkModeToggle: () => void;
  onTabChange: (updater: (tab: TimelineTab) => TimelineTab) => void;
}

const AUTO_LABELS = new Set(["", "New timeline"]);

const shouldAutoLabel = (
  label: string,
  spreadsheetName: string,
  sheetName: string,
) => {
  const trimmed = label.trim();
  if (AUTO_LABELS.has(trimmed)) return true;
  return trimmed === getDefaultTabLabel({ spreadsheetName, sheetName });
};

export const TimelineTabView: React.FC<TimelineTabViewProps> = ({
  tab,
  dark,
  allowPicker,
  onDarkModeToggle,
  onTabChange,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("settings");
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>(
    new Date().toLocaleString("pt-BR"),
  );
  const loadedKeyRef = useRef("");

  const {
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    sheetName,
    configured,
  } = tab;

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchSheetRows(spreadsheetId, sheetName);
      setRows(payload.rows);
      setHeaders(payload.headers);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, sheetName]);

  const handleSelectionChange = useCallback(
    async (selection: SheetSelection) => {
      setLoading(true);
      setError(null);
      try {
        const state = await fetchSheetState(
          selection.spreadsheetId,
          selection.sheetName,
        );
        const detected = state.config as Partial<SpreadsheetConfig>;

        onTabChange((current) => ({
          ...current,
          ...state.meta,
          configured: true,
          label: shouldAutoLabel(
            current.label,
            state.meta.spreadsheetName,
            state.meta.sheetName,
          )
            ? getDefaultTabLabel({
                spreadsheetName: state.meta.spreadsheetName,
                sheetName: state.meta.sheetName,
              })
            : current.label,
          config: { ...DEFAULT_SPREADSHEET_CONFIG, ...detected },
        }));

        setRows(state.rows);
        setHeaders(state.headers);
        loadedKeyRef.current = `${state.meta.spreadsheetId}::${state.meta.sheetName}`;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [onTabChange],
  );

  useEffect(() => {
    if (!spreadsheetId) {
      setRows([]);
      setHeaders([]);
      loadedKeyRef.current = "";
      return;
    }

    if (!configured) {
      void handleSelectionChange({
        spreadsheetId,
        spreadsheetName,
        spreadsheetUrl,
        sheetName,
      });
      return;
    }

    if (loadedKeyRef.current === `${spreadsheetId}::${sheetName}`) return;
    loadedKeyRef.current = `${spreadsheetId}::${sheetName}`;
    void loadRows();
  }, [
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    sheetName,
    configured,
    handleSelectionChange,
    loadRows,
  ]);

  const handleConfigChange = useCallback<
    React.Dispatch<React.SetStateAction<SpreadsheetConfig>>
  >(
    (value) => {
      onTabChange((current) => ({
        ...current,
        config:
          typeof value === "function"
            ? (value as (prev: SpreadsheetConfig) => SpreadsheetConfig)(
                current.config,
              )
            : value,
      }));
    },
    [onTabChange],
  );

  const fieldOptions = useMemo(
    () => buildFieldOptions(rows, headers),
    [rows, headers],
  );

  const metadataFields = useMemo(() => {
    const coreFields = new Set<string>(
      [
        tab.config.fieldMap.name,
        tab.config.fieldMap.start,
        tab.config.fieldMap.end,
        tab.config.fieldMap.due,
        tab.config.statusField || "",
      ].filter(Boolean),
    );

    return fieldOptions.filter((option) => !coreFields.has(option));
  }, [fieldOptions, tab.config.fieldMap, tab.config.statusField]);

  const tasks = useMemo(
    () => sanitizeSpreadsheetData(rows, tab.config.fieldMap),
    [rows, tab.config.fieldMap],
  );

  function onSync() {
    loadRows();
    setGeneratedAt(new Date().toLocaleString("pt-BR"));
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        viewMode={viewMode}
        dark={dark}
        loading={loading}
        onViewModeChange={setViewMode}
        onDarkModeToggle={onDarkModeToggle}
        onSync={onSync}
      />

      {error ? (
        <div
          role="alert"
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {viewMode === "timeline" ? (
        tasks.length > 0 ? (
          <div className="flex-1 min-h-0">
            <Timeline
              tasks={tasks}
              title={tab.config.title}
              filterFields={tab.config.filterFields}
              popupFields={tab.config.popupFields}
              sheetUrl={tab.spreadsheetUrl}
              statusField={tab.config.statusField}
              generatedAt={generatedAt}
            />
          </div>
        ) : (
          <div className="flex min-h-[60vh] items-center justify-center p-8 text-center">
            <div className="max-w-md rounded-lg border border-dashed border-border bg-card p-6">
              <h2 className="text-lg font-semibold">
                No spreadsheet rows loaded
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Open the Configuration tab, choose a spreadsheet, and map the
                date columns.
              </p>
            </div>
          </div>
        )
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SettingsPanel
            tab={tab}
            fieldOptions={fieldOptions}
            metadataFields={metadataFields}
            allowPicker={allowPicker}
            onConfigChange={handleConfigChange}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      )}
    </div>
  );
};
