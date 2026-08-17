import {
  DEFAULT_SPREADSHEET_CONFIG,
  normalizeFieldMap,
  normalizeStatusField,
  type SpreadsheetConfig,
} from "./sheetConfig";

declare global {
  interface Window {
    __TIMELINE_DATA__?: any[];
    __TIMELINE_HEADERS__?: string[];
    __TIMELINE_CONFIG__?: Partial<SpreadsheetConfig>;
    __TIMELINE_REFRESH__?: () => void;
  }
}

const getHostConfig = (
  hostConfig: Partial<SpreadsheetConfig> = {},
): SpreadsheetConfig => {
  const base = { ...DEFAULT_SPREADSHEET_CONFIG, ...hostConfig };

  return {
    ...base,
    statusField: normalizeStatusField(hostConfig.statusField),
    fieldMap: normalizeFieldMap(hostConfig.fieldMap),
    popupFields: Array.isArray(hostConfig.popupFields)
      ? hostConfig.popupFields
      : DEFAULT_SPREADSHEET_CONFIG.popupFields,
    filterFields: Array.isArray(hostConfig.filterFields)
      ? hostConfig.filterFields
      : DEFAULT_SPREADSHEET_CONFIG.filterFields,
  };
};

export const getWindowConfig = (): SpreadsheetConfig => {
  return getHostConfig(window.__TIMELINE_CONFIG__ || {});
};

export const getWindowData = (): any[] => {
  return Array.isArray(window.__TIMELINE_DATA__)
    ? window.__TIMELINE_DATA__
    : [];
};

export const getWindowHeaders = (): string[] => {
  return Array.isArray(window.__TIMELINE_HEADERS__)
    ? window.__TIMELINE_HEADERS__
    : [];
};

export const getSheetPayload = (): Promise<{
  rows: any[];
  headers: string[];
  config: SpreadsheetConfig;
}> => {
  return new Promise((resolve) => {
    const appsScriptGoogle = (globalThis as any).google;

    if (!appsScriptGoogle?.script?.run) {
      resolve({
        rows: getWindowData(),
        headers: getWindowHeaders(),
        config: getWindowConfig(),
      });
      return;
    }

    appsScriptGoogle.script.run
      .withSuccessHandler(
        (
          payload:
            | string
            | {
                rows?: any[];
                headers?: string[];
                config?: Partial<SpreadsheetConfig>;
              },
        ) => {
          try {
            const parsed =
              typeof payload === "string" ? JSON.parse(payload) : payload || {};
            const rows = Array.isArray(parsed.rows)
              ? parsed.rows
              : getWindowData();
            const headers = Array.isArray(parsed.headers)
              ? parsed.headers
              : getWindowHeaders();
            const config = getHostConfig(parsed.config || getWindowConfig());
            resolve({ rows, headers, config });
          } catch {
            resolve({
              rows: getWindowData(),
              headers: getWindowHeaders(),
              config: getWindowConfig(),
            });
          }
        },
      )
      .getSheetState();
  });
};

export const getSheetRows = (): Promise<any[]> => {
  return new Promise((resolve) => {
    const appsScriptGoogle = (globalThis as any).google;

    if (!appsScriptGoogle?.script?.run) {
      resolve(getWindowData());
      return;
    }

    appsScriptGoogle.script.run
      .withSuccessHandler((payload: string | any[]) => {
        try {
          const rows =
            typeof payload === "string" ? JSON.parse(payload) : payload;
          resolve(Array.isArray(rows) ? rows : getWindowData());
        } catch {
          resolve(getWindowData());
        }
      })
      .getSheetRows();
  });
};
