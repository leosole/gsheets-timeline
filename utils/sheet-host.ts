import type { SpreadsheetConfig } from "./sheet-config";
import type { SheetSelection } from "./workspace";
import { getAccessToken } from "./vercel-auth";
import {
  loadWorkspaceFromDrive,
  saveWorkspaceToDrive,
} from "./drive-workspace";

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
    __TIMELINE_VERCEL__?: boolean;
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

const isVercelMode = (): boolean =>
  typeof window !== "undefined" &&
  (window as any).__TIMELINE_VERCEL__ === true;

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

/**
 * Returns true when the app is running inside Google Apps Script or on Vercel.
 * In both cases the app should call a backend rather than using localStorage
 * for spreadsheet data.
 */
export const isHosted = (): boolean => getScriptRun() !== null || isVercelMode();

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

// ---------------------------------------------------------------------------
// Apps Script caller (existing — unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Google Sheets API helpers (used by Vercel mode — client-side with user token)
// ---------------------------------------------------------------------------

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function sheetsGet(
  spreadsheetId: string,
  params: Record<string, string>,
): Promise<any> {
  const token = await getAccessToken();
  const qs = new URLSearchParams(params);
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API error (${res.status}): ${body}`);
  }
  return res.json();
}

async function sheetsGetValues(
  spreadsheetId: string,
  range: string,
): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API values error (${res.status}): ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Header / config detection (mirrors Code.gs logic)
// ---------------------------------------------------------------------------

function findHeaderRowIndex(values: any[][]): number {
  for (let i = 0; i < values.length; i++) {
    const hasAny = values[i].some((v) => String(v == null ? "" : v).trim());
    if (hasAny) return i;
  }
  return -1;
}

function readHeaders(values: any[][], headerRowIndex: number): string[] {
  if (headerRowIndex < 0 || headerRowIndex >= values.length) return [];
  return values[headerRowIndex]
    .map((v) => String(v == null ? "" : v).trim())
    .filter(Boolean);
}

function detectConfig(headers: string[]) {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h))) || "";

  return {
    title: "",
    statusField: find([/^(status|estado|situacao|state)$/i]),
    fieldMap: {
      name: find([/^(name|task|title)$/i]) || headers[0] || "",
      start: find([/^(start|start date|inicio|date inicio|início)$/i]),
      end: find([/^(end|end date|fim|date fim)$/i]),
      due: find([/^(due|due date|deadline|prazo|previsto)$/i]),
    },
    popupFields: [],
    filterFields: [],
  };
}

// ---------------------------------------------------------------------------
// Local dev stubs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Workspace persistence
// ---------------------------------------------------------------------------

export const fetchWorkspace = async (): Promise<string> => {
  // --- Vercel mode: load from Google Drive (cross-device sync) ---
  if (isVercelMode()) {
    try {
      const stored = await loadWorkspaceFromDrive();
      if (stored && hasAnySpreadsheetSelection(stored)) {
        return stored;
      }
    } catch (cause) {
      console.warn("Failed to load workspace from Drive; using default.", cause);
    }
    // Return an empty workspace so the user can pick a spreadsheet.
    return JSON.stringify({ tabs: [] });
  }

  // --- Local dev mode ---
  if (!isHosted()) {
    const stored = localStorage.getItem(DEV_WORKSPACE_KEY) || "";
    if (!stored || !hasAnySpreadsheetSelection(stored)) {
      const fallback = getDefaultDevWorkspace();
      localStorage.setItem(DEV_WORKSPACE_KEY, fallback);
      return fallback;
    }
    return stored;
  }

  // --- Apps Script mode ---
  const payload = await invoke("getWorkspace");
  return typeof payload === "string" ? payload : "";
};

export const persistWorkspace = async (json: string): Promise<void> => {
  // --- Vercel mode: save to Google Drive (cross-device sync) ---
  if (isVercelMode()) {
    try {
      await saveWorkspaceToDrive(json);
    } catch (cause) {
      console.warn("Failed to save workspace to Drive.", cause);
    }
    return;
  }

  // --- Local dev mode ---
  if (!isHosted()) {
    localStorage.setItem(DEV_WORKSPACE_KEY, json);
    return;
  }

  // --- Apps Script mode ---
  await callServer<boolean>("saveWorkspace", json);
};

// ---------------------------------------------------------------------------
// Spreadsheet data fetching — three modes
// ---------------------------------------------------------------------------

export const fetchSpreadsheetMeta = async (
  spreadsheetId: string,
): Promise<SpreadsheetMeta> => {
  // --- Vercel mode: call Sheets API directly with the user's own token ---
  if (isVercelMode()) {
    const data = await sheetsGet(spreadsheetId, {
      fields: "spreadsheetId,properties.title,sheets.properties.title",
    });
    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetName: data.properties?.title || "",
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      sheetNames: (data.sheets || []).map(
        (s: any) => s.properties?.title || "",
      ),
    };
  }

  // --- Apps Script mode ---
  if (isHosted()) {
    return callServer<SpreadsheetMeta>("getSpreadsheetMeta", spreadsheetId);
  }

  // --- Local dev mode ---
  return {
    spreadsheetId: spreadsheetId || DEV_SPREADSHEET_ID,
    spreadsheetName: DEV_SPREADSHEET_NAME,
    spreadsheetUrl: "",
    sheetNames: [DEV_SHEET_NAME],
  };
};

export const fetchSheetState = async (
  spreadsheetId: string,
  sheetName: string,
): Promise<SheetState> => {
  // --- Vercel mode: read headers via Sheets API, detect config client-side ---
  if (isVercelMode()) {
    const meta = await fetchSpreadsheetMeta(spreadsheetId);
    const effectiveSheet = sheetName || meta.sheetNames[0] || "Sheet1";

    const range = `${effectiveSheet}!1:50`;
    const res = await sheetsGetValues(spreadsheetId, range);
    const values: any[][] = res.values || [];

    const headerRowIndex = findHeaderRowIndex(values);
    const headers =
      headerRowIndex >= 0 ? readHeaders(values, headerRowIndex) : [];

    return {
      rows: [],
      headers,
      meta: { ...meta, sheetName: effectiveSheet },
      config: detectConfig(headers),
    };
  }

  // --- Apps Script mode ---
  if (isHosted()) {
    return callServer<SheetState>("getSheetState", spreadsheetId, sheetName);
  }

  // --- Local dev mode ---
  return devSheetState({ spreadsheetId, sheetName });
};

export const fetchSheetRows = async (
  spreadsheetId: string,
  sheetName: string,
): Promise<{ rows: any[]; headers: string[] }> => {
  // --- Vercel mode: read all rows via Sheets API with the user's token ---
  if (isVercelMode()) {
    const meta = await fetchSpreadsheetMeta(spreadsheetId);
    const effectiveSheet = sheetName || meta.sheetNames[0] || "Sheet1";

    const res = await sheetsGetValues(spreadsheetId, effectiveSheet);
    const values: any[][] = res.values || [];

    if (values.length === 0) return { rows: [], headers: [] };

    const headerRowIndex = findHeaderRowIndex(values);
    if (headerRowIndex < 0) return { rows: [], headers: [] };

    const headers = readHeaders(values, headerRowIndex);
    const firstDataRow = headerRowIndex + 2; // 1-indexed after header row

    const rows = values.slice(headerRowIndex + 1).map((row, rowIndex) => {
      const sheetRow = firstDataRow + rowIndex;
      const rowObject: Record<string, any> = {};
      headers.forEach((header, index) => {
        rowObject[header] = row[index] !== undefined ? row[index] : "";
      });
      rowObject.__sheetRow = sheetRow;
      return rowObject;
    });

    return { rows, headers };
  }

  // --- Apps Script mode ---
  if (isHosted()) {
    return callServer<{ rows: any[]; headers: string[] }>(
      "getSheetRows",
      spreadsheetId,
      sheetName,
    );
  }

  // --- Local dev mode ---
  const state = devSheetState({ spreadsheetId, sheetName });
  return { rows: state.rows, headers: state.headers };
};

export const fetchSheetRowGroups = async (
  spreadsheetId: string,
  sheetName: string,
): Promise<{ rowMeta: SheetRowGroupMeta }> => {
  // --- Vercel mode: read row groups via Sheets API with the user's token ---
  if (isVercelMode()) {
    try {
      const meta = await fetchSpreadsheetMeta(spreadsheetId);
      const effectiveSheet = sheetName || meta.sheetNames[0] || "Sheet1";

      // Read first 50 rows to find header position.
      const range = `${effectiveSheet}!1:50`;
      const res = await sheetsGetValues(spreadsheetId, range);
      const values: any[][] = res.values || [];

      const headerRowIndex = findHeaderRowIndex(values);
      if (headerRowIndex < 0) return { rowMeta: {} };

      const firstDataRow = headerRowIndex + 2;
      const dataEndRow = firstDataRow + values.length - headerRowIndex - 2;

      const groupData = await sheetsGet(spreadsheetId, {
        ranges: effectiveSheet,
        fields:
          "sheets(properties(sheetId),rowGroups(range(startIndex,endIndex),depth))",
      });

      const apiSheet = (groupData.sheets || []).find(
        (s: any) => s.properties?.sheetId !== undefined,
      );
      const rowGroups = (apiSheet?.rowGroups || []).filter(
        (g: any) => Number(g.depth || 0) <= 1,
      );

      return {
        rowMeta: buildRowGroupMeta(rowGroups, firstDataRow, dataEndRow),
      };
    } catch (cause) {
      console.warn("Timeline row grouping is unavailable.", cause);
      return { rowMeta: {} };
    }
  }

  // --- Apps Script mode ---
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

// ---------------------------------------------------------------------------
// Row group meta builder (used by Vercel mode)
// ---------------------------------------------------------------------------

function buildRowGroupMeta(
  rowGroups: any[],
  dataStartRow: number,
  dataEndRow: number,
): SheetRowGroupMeta {
  const meta: SheetRowGroupMeta = {};

  for (const group of rowGroups) {
    if (Number(group.depth || 0) > 1) continue;
    const range = group.range || {};
    if (
      typeof range.startIndex !== "number" ||
      typeof range.endIndex !== "number"
    )
      continue;

    const firstChildRow = Math.max(range.startIndex + 1, dataStartRow);
    const lastChildRow = Math.min(range.endIndex, dataEndRow);
    if (lastChildRow < firstChildRow) continue;

    let parentRow = firstChildRow - 1;
    if (parentRow < dataStartRow) parentRow = firstChildRow;

    if (!meta[parentRow])
      meta[parentRow] = { __sheetRow: parentRow, __groupChildCount: 0 };
    meta[parentRow].__isGroupParent = true;
    meta[parentRow].__groupCollapsed = false;

    for (let rowNum = firstChildRow; rowNum <= lastChildRow; rowNum++) {
      if (rowNum === parentRow) continue;
      if (!meta[rowNum])
        meta[rowNum] = { __sheetRow: rowNum, __groupParentRow: parentRow };
      else meta[rowNum].__groupParentRow = parentRow;
      meta[parentRow].__groupChildCount =
        (meta[parentRow].__groupChildCount || 0) + 1;
    }
  }

  return meta;
}

// ---------------------------------------------------------------------------
// Picker configuration
// ---------------------------------------------------------------------------

/**
 * Returns credentials for the Google Picker API.
 *
 * - In Apps Script: reads from Script Properties via the server.
 * - On Vercel: reads from environment variables; the OAuth token is obtained
 *   separately via Google Identity Services (same token used for Sheets).
 * - In local dev: returns dummy values (Picker is not available).
 */
export const fetchPickerConfig = async (): Promise<PickerConfig> => {
  if (isVercelMode()) {
    const developerKey =
      (import.meta as any).env?.VITE_GOOGLE_API_KEY ||
      (window as any).__GOOGLE_API_KEY__ ||
      "";
    const appId =
      (import.meta as any).env?.VITE_GOOGLE_PROJECT_NUMBER ||
      (window as any).__GOOGLE_PROJECT_NUMBER__ ||
      "";

    return { token: "", developerKey, appId };
  }
  return callServer<PickerConfig>("getPickerConfig");
};
