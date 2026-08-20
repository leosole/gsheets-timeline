import type { SpreadsheetConfig } from "./sheet-config";
import type { SheetSelection } from "./workspace";

export type HostMode = "addon" | "webapp";

export interface Bootstrap {
  mode: HostMode;
  bound: SheetSelection | null;
}

export interface SpreadsheetMeta {
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  sheetNames: string[];
}

export interface SheetState {
  rows: any[];
  headers: string[];
  meta: SheetSelection;
  config: Partial<SpreadsheetConfig>;
}

export interface PickerConfig {
  token: string;
  developerKey: string;
  appId: string;
}

export type SheetRowGroupMeta = Record<
  string,
  {
    __sheetRow?: number;
    __groupParentRow?: number;
    __isGroupParent?: boolean;
    __groupCollapsed?: boolean;
    __groupChildCount?: number;
  }
>;

declare global {
  interface Window {
    __TIMELINE_BOOTSTRAP__?: Bootstrap;
    __TIMELINE_DATA__?: any[];
    __TIMELINE_HEADERS__?: string[];
  }
}

const DEV_WORKSPACE_KEY = "timeline-dev-workspace";
const DEV_SPREADSHEET_ID = "dev-spreadsheet";
const DEV_SPREADSHEET_NAME = "Dev spreadsheet";
const DEV_SHEET_NAME = "Sheet1";
const ROW_CACHE_PREFIX = "timeline-row-cache:";
const ROW_CACHE_INDEX_KEY = "timeline-row-cache:index";
const MAX_ROW_CACHE_BYTES = 1_500_000;
const MAX_ROW_CACHE_ENTRIES = 5;

const getDefaultDevWorkspace = (): string =>
  JSON.stringify({
    tabs: [
      {
        label: `${DEV_SPREADSHEET_NAME}/${DEV_SHEET_NAME}`,
        spreadsheetId: DEV_SPREADSHEET_ID,
        spreadsheetName: DEV_SPREADSHEET_NAME,
        spreadsheetUrl: "",
        sheetName: DEV_SHEET_NAME,
        activePanel: "timeline",
        configured: true,
      },
    ],
  });

const hasAnySpreadsheetSelection = (json: string): boolean => {
  try {
    const parsed = JSON.parse(json) as {
      tabs?: Array<{ spreadsheetId?: unknown }>;
    };
    if (!Array.isArray(parsed.tabs)) return false;
    return parsed.tabs.some(
      (tab) =>
        typeof tab?.spreadsheetId === "string" && tab.spreadsheetId.trim(),
    );
  } catch {
    return false;
  }
};

export interface CachedSheetRows {
  rows: any[];
  headers: string[];
  cachedAt: string;
}

type ScriptRun = Record<string, (...args: any[]) => void> & {
  withSuccessHandler: (handler: (value: any) => void) => ScriptRun;
  withFailureHandler: (handler: (error: Error) => void) => ScriptRun;
};

const getScriptRun = (): ScriptRun | null =>
  (globalThis as any).google?.script?.run ?? null;

const canUseLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== "undefined";
  } catch {
    return false;
  }
};

const getRowCacheKey = (spreadsheetId: string, sheetName: string): string =>
  `${ROW_CACHE_PREFIX}${encodeURIComponent(spreadsheetId)}::${encodeURIComponent(sheetName)}`;

const readRowCacheIndex = (): string[] => {
  if (!canUseLocalStorage()) return [];
  try {
    const value = localStorage.getItem(ROW_CACHE_INDEX_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
};

const writeRowCacheIndex = (keys: string[]) => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(ROW_CACHE_INDEX_KEY, JSON.stringify(keys));
  } catch {
    // Row cache is opportunistic; quota/security failures should not break loading.
  }
};

export const isHosted = (): boolean => getScriptRun() !== null;

export const getBootstrap = (): Bootstrap =>
  window.__TIMELINE_BOOTSTRAP__ ?? { mode: "webapp", bound: null };

export const readCachedSheetRows = (
  spreadsheetId: string,
  sheetName: string,
): CachedSheetRows | null => {
  if (!spreadsheetId || !canUseLocalStorage()) return null;

  try {
    const value = localStorage.getItem(
      getRowCacheKey(spreadsheetId, sheetName),
    );
    if (!value) return null;

    const parsed = JSON.parse(value) as Partial<CachedSheetRows>;
    if (!Array.isArray(parsed.rows) || !Array.isArray(parsed.headers)) {
      return null;
    }

    return {
      rows: parsed.rows,
      headers: parsed.headers.filter(
        (header): header is string => typeof header === "string",
      ),
      cachedAt:
        typeof parsed.cachedAt === "string"
          ? parsed.cachedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const writeCachedSheetRows = (
  spreadsheetId: string,
  sheetName: string,
  payload: { rows: any[]; headers: string[] },
) => {
  if (!spreadsheetId || !canUseLocalStorage()) return;

  const key = getRowCacheKey(spreadsheetId, sheetName);
  const value = JSON.stringify({
    rows: payload.rows,
    headers: payload.headers,
    cachedAt: new Date().toISOString(),
  });

  if (value.length > MAX_ROW_CACHE_BYTES) return;

  try {
    localStorage.setItem(key, value);

    const nextIndex = [
      key,
      ...readRowCacheIndex().filter((item) => item !== key),
    ];
    nextIndex.slice(MAX_ROW_CACHE_ENTRIES).forEach((oldKey) => {
      localStorage.removeItem(oldKey);
    });
    writeRowCacheIndex(nextIndex.slice(0, MAX_ROW_CACHE_ENTRIES));
  } catch {
    // Ignore cache writes when browser storage is unavailable or full.
  }
};

const invoke = (fn: string, ...args: unknown[]): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const run = getScriptRun();
    if (!run) {
      reject(
        new Error(`Not running inside Apps Script; "${fn}" is unavailable.`),
      );
      return;
    }

    run
      .withSuccessHandler(resolve)
      .withFailureHandler((error: Error) => reject(error))
      [fn](...args);
  });

/** Apps Script server functions return JSON strings; unwrap them transparently. */
const callServer = async <T>(fn: string, ...args: unknown[]): Promise<T> => {
  const payload = await invoke(fn, ...args);
  return typeof payload === "string"
    ? (JSON.parse(payload) as T)
    : (payload as T);
};

const devSheetState = (selection: Partial<SheetSelection>): SheetState => ({
  rows: Array.isArray(window.__TIMELINE_DATA__) ? window.__TIMELINE_DATA__ : [],
  headers: Array.isArray(window.__TIMELINE_HEADERS__)
    ? window.__TIMELINE_HEADERS__
    : [],
  meta: {
    spreadsheetId: selection.spreadsheetId || DEV_SPREADSHEET_ID,
    spreadsheetName: selection.spreadsheetName || DEV_SPREADSHEET_NAME,
    spreadsheetUrl: selection.spreadsheetUrl || "",
    sheetName: selection.sheetName || DEV_SHEET_NAME,
  },
  config: {},
});

// Stored as an opaque string so an empty workspace is not run through JSON.parse.
export const fetchWorkspace = async (): Promise<string> => {
  if (!isHosted()) {
    const stored = localStorage.getItem(DEV_WORKSPACE_KEY) || "";
    if (!stored || !hasAnySpreadsheetSelection(stored)) {
      const fallback = getDefaultDevWorkspace();
      localStorage.setItem(DEV_WORKSPACE_KEY, fallback);
      return fallback;
    }
    return stored;
  }
  const payload = await invoke("getWorkspace");
  return typeof payload === "string" ? payload : "";
};

export const persistWorkspace = async (json: string): Promise<void> => {
  if (!isHosted()) {
    localStorage.setItem(DEV_WORKSPACE_KEY, json);
    return;
  }
  await callServer<boolean>("saveWorkspace", json);
};

export const fetchSpreadsheetMeta = async (
  spreadsheetId: string,
): Promise<SpreadsheetMeta> => {
  if (!isHosted()) {
    return {
      spreadsheetId: spreadsheetId || DEV_SPREADSHEET_ID,
      spreadsheetName: DEV_SPREADSHEET_NAME,
      spreadsheetUrl: "",
      sheetNames: [DEV_SHEET_NAME],
    };
  }
  return callServer<SpreadsheetMeta>("getSpreadsheetMeta", spreadsheetId);
};

export const fetchSheetState = async (
  spreadsheetId: string,
  sheetName: string,
): Promise<SheetState> => {
  if (!isHosted()) return devSheetState({ spreadsheetId, sheetName });
  return callServer<SheetState>("getSheetState", spreadsheetId, sheetName);
};

export const fetchSheetRows = async (
  spreadsheetId: string,
  sheetName: string,
): Promise<{ rows: any[]; headers: string[] }> => {
  if (!isHosted()) {
    const state = devSheetState({ spreadsheetId, sheetName });
    return { rows: state.rows, headers: state.headers };
  }
  return callServer<{ rows: any[]; headers: string[] }>(
    "getSheetRows",
    spreadsheetId,
    sheetName,
  );
};

export const fetchSheetRowGroups = async (
  spreadsheetId: string,
  sheetName: string,
): Promise<{ rowMeta: SheetRowGroupMeta }> => {
  if (!isHosted()) return { rowMeta: {} };
  try {
    return await callServer<{ rowMeta: SheetRowGroupMeta }>(
      "getSheetRowGroups",
      spreadsheetId,
      sheetName,
    );
  } catch (cause) {
    console.warn("Timeline row grouping is unavailable.", cause);
    return { rowMeta: {} };
  }
};

export const fetchPickerConfig = (): Promise<PickerConfig> =>
  callServer<PickerConfig>("getPickerConfig");
