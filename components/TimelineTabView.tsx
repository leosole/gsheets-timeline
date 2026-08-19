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
import {
  fetchSheetRowGroups,
  fetchSheetRows,
  fetchSheetState,
  readCachedSheetRows,
  type SheetRowGroupMeta,
  writeCachedSheetRows,
} from "../utils/sheetHost";
import {
  getDefaultTabLabel,
  type ActivePanel,
  type SheetSelection,
  type TimelineTab,
} from "../utils/workspace";

export type ViewMode = ActivePanel;

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

const mergeRowsWithGroupMeta = (
  rows: any[],
  rowMeta: SheetRowGroupMeta,
): any[] => {
  if (Object.keys(rowMeta).length === 0) return rows;

  return rows.map((row) => {
    const sheetRow = typeof row.__sheetRow === "number" ? row.__sheetRow : -1;
    const metadata = sheetRow >= 0 ? rowMeta[String(sheetRow)] : undefined;
    if (!metadata) return row;

    return { ...row, ...metadata };
  });
};

export const TimelineTabView: React.FC<TimelineTabViewProps> = ({
  tab,
  dark,
  allowPicker,
  onDarkModeToggle,
  onTabChange,
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string>(
    new Date().toLocaleString("pt-BR"),
  );
  const [showingCachedRows, setShowingCachedRows] = useState(false);
  const [groupingRows, setGroupingRows] = useState(false);
  const loadedKeyRef = useRef("");
  const groupedKeyRef = useRef("");

  const {
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    sheetName,
    configured,
  } = tab;
  const viewMode = tab.activePanel;

  const loadRows = useCallback(async () => {
    const cacheKey = `${spreadsheetId}::${sheetName}`;
    const cached = readCachedSheetRows(spreadsheetId, sheetName);
    if (cached && rows.length === 0) {
      setRows(cached.rows);
      setHeaders(cached.headers);
      setGeneratedAt(new Date(cached.cachedAt).toLocaleString("pt-BR"));
      setShowingCachedRows(true);
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await fetchSheetRows(spreadsheetId, sheetName);
      setRows(payload.rows);
      setHeaders(payload.headers);
      setGeneratedAt(new Date().toLocaleString("pt-BR"));
      setShowingCachedRows(false);
      groupedKeyRef.current = "";
      writeCachedSheetRows(spreadsheetId, sheetName, payload);
      if (payload.rows.length === 0) groupedKeyRef.current = cacheKey;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId, sheetName, rows.length]);

  const loadSheetState = useCallback(
    async (selection: SheetSelection, applyDetectedConfig: boolean) => {
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
          config: applyDetectedConfig
            ? { ...DEFAULT_SPREADSHEET_CONFIG, ...detected }
            : current.config,
        }));

        setRows(state.rows);
        setHeaders(state.headers);
        loadedKeyRef.current = state.rows.length > 0
          ? `${state.meta.spreadsheetId}::${state.meta.sheetName}`
          : "";
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setLoading(false);
      }
    },
    [onTabChange],
  );

  const handleSelectionChange = useCallback(
    (selection: SheetSelection) => {
      void loadSheetState(selection, true);
    },
    [loadSheetState],
  );

  useEffect(() => {
    if (!spreadsheetId) {
      setRows([]);
      setHeaders([]);
      setShowingCachedRows(false);
      setGroupingRows(false);
      loadedKeyRef.current = "";
      groupedKeyRef.current = "";
      return;
    }

    if (!configured || (viewMode === "settings" && headers.length === 0)) {
      void loadSheetState({
        spreadsheetId,
        spreadsheetName,
        spreadsheetUrl,
        sheetName,
      }, !configured);
      return;
    }

    if (viewMode !== "timeline" && headers.length > 0) return;

    if (loadedKeyRef.current === `${spreadsheetId}::${sheetName}`) return;
    loadedKeyRef.current = `${spreadsheetId}::${sheetName}`;
    void loadRows();
  }, [
    spreadsheetId,
    spreadsheetName,
    spreadsheetUrl,
    sheetName,
    configured,
    headers.length,
    viewMode,
    loadSheetState,
    loadRows,
  ]);

  useEffect(() => {
    if (!spreadsheetId || viewMode !== "timeline" || rows.length === 0) return;

    const key = `${spreadsheetId}::${sheetName}`;
    if (groupedKeyRef.current === key) return;
    groupedKeyRef.current = key;

    let cancelled = false;
    setGroupingRows(true);
    fetchSheetRowGroups(spreadsheetId, sheetName)
      .then(({ rowMeta }) => {
        if (cancelled) return;
        setRows((currentRows) => mergeRowsWithGroupMeta(currentRows, rowMeta));
      })
      .finally(() => {
        if (!cancelled) setGroupingRows(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spreadsheetId, sheetName, viewMode, rows.length]);

  const handleViewModeChange = useCallback(
    (activePanel: ViewMode) => {
      onTabChange((current) => ({ ...current, activePanel }));
    },
    [onTabChange],
  );

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

  const fieldOptions = useMemo(() => buildFieldOptions([], headers), [headers]);

  const tasks = useMemo(
    () => sanitizeSpreadsheetData(rows, tab.config.fieldMap),
    [rows, tab.config.fieldMap],
  );
  const showInitialLoading = loading && tasks.length === 0;

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
        onViewModeChange={handleViewModeChange}
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
            {loading && showingCachedRows ? (
              <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                Showing cached rows while refreshing from Google Sheets.
              </div>
            ) : null}
            {groupingRows ? (
              <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                <span
                  className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                  aria-hidden="true"
                />
                <span>Grouping rows...</span>
              </div>
            ) : null}
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
        ) : showInitialLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center p-8 text-center">
            <div className="flex max-w-md flex-col items-center rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                aria-hidden="true"
              />
              <h2 className="mt-4 text-lg font-semibold">
                Loading spreadsheet rows
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Fetching the latest timeline data from Google Sheets.
              </p>
            </div>
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
            allowPicker={allowPicker}
            loading={loading}
            onConfigChange={handleConfigChange}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      )}
    </div>
  );
};
