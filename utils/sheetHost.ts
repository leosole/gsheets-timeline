import type { SpreadsheetConfig } from "./sheetConfig";
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

declare global {
  interface Window {
    __TIMELINE_BOOTSTRAP__?: Bootstrap;
    __TIMELINE_DATA__?: any[];
    __TIMELINE_HEADERS__?: string[];
  }
}

const DEV_WORKSPACE_KEY = "timeline-dev-workspace";

type ScriptRun = Record<string, (...args: any[]) => void> & {
  withSuccessHandler: (handler: (value: any) => void) => ScriptRun;
  withFailureHandler: (handler: (error: Error) => void) => ScriptRun;
};

const getScriptRun = (): ScriptRun | null =>
  (globalThis as any).google?.script?.run ?? null;

export const isHosted = (): boolean => getScriptRun() !== null;

export const getBootstrap = (): Bootstrap =>
  window.__TIMELINE_BOOTSTRAP__ ?? { mode: "webapp", bound: null };

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
    spreadsheetId: selection.spreadsheetId || "dev-spreadsheet",
    spreadsheetName: selection.spreadsheetName || "Dev spreadsheet",
    spreadsheetUrl: selection.spreadsheetUrl || "",
    sheetName: selection.sheetName || "Sheet1",
  },
  config: {},
});

// Stored as an opaque string so an empty workspace is not run through JSON.parse.
export const fetchWorkspace = async (): Promise<string> => {
  if (!isHosted()) return localStorage.getItem(DEV_WORKSPACE_KEY) || "";
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
      spreadsheetId: spreadsheetId || "dev-spreadsheet",
      spreadsheetName: "Dev spreadsheet",
      spreadsheetUrl: "",
      sheetNames: ["Sheet1"],
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

export const fetchPickerConfig = (): Promise<PickerConfig> =>
  callServer<PickerConfig>("getPickerConfig");
