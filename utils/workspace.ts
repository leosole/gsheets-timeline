import {
  DEFAULT_SPREADSHEET_CONFIG,
  normalizeFieldMap,
  normalizeStatusField,
  type SpreadsheetConfig,
} from "./sheetConfig";

export const WORKSPACE_VERSION = 1;

export interface SheetSelection {
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  sheetName: string;
}

export interface TimelineTab extends SheetSelection {
  id: string;
  label: string;
  /** False until the column mapping has been auto-detected for the current sheet. */
  configured: boolean;
  config: SpreadsheetConfig;
}

export interface WorkspaceState {
  version: number;
  activeTabId: string;
  tabs: TimelineTab[];
}

export const EMPTY_SELECTION: SheetSelection = {
  spreadsheetId: "",
  spreadsheetName: "",
  spreadsheetUrl: "",
  sheetName: "",
};

export const getDefaultTabLabel = ({
  spreadsheetName,
  sheetName,
}: Partial<Pick<SheetSelection, "spreadsheetName" | "sheetName">>): string => {
  const spreadsheet = spreadsheetName?.trim();
  const sheet = sheetName?.trim();

  if (!spreadsheet && !sheet) return "New timeline";
  if (!spreadsheet) return sheet || "New timeline";
  if (!sheet) return spreadsheet;
  return `${spreadsheet}/${sheet}`;
};

let tabCounter = 0;

export const createTabId = (): string => {
  tabCounter += 1;
  return `tab-${Date.now().toString(36)}-${tabCounter.toString(36)}`;
};

export const createTab = (
  overrides: Partial<TimelineTab> = {},
): TimelineTab => ({
  id: createTabId(),
  label:
    overrides.label ??
    getDefaultTabLabel({
      spreadsheetName: overrides.spreadsheetName,
      sheetName: overrides.sheetName,
    }),
  ...EMPTY_SELECTION,
  configured: false,
  config: { ...DEFAULT_SPREADSHEET_CONFIG },
  ...overrides,
});

export const createWorkspace = (
  tabs: TimelineTab[] = [createTab()],
): WorkspaceState => ({
  version: WORKSPACE_VERSION,
  activeTabId: tabs[0].id,
  tabs,
});

const normalizeConfig = (
  config?: Partial<SpreadsheetConfig>,
): SpreadsheetConfig => ({
  ...DEFAULT_SPREADSHEET_CONFIG,
  ...config,
  title:
    typeof config?.title === "string"
      ? config.title
      : DEFAULT_SPREADSHEET_CONFIG.title,
  statusField: normalizeStatusField(config?.statusField),
  fieldMap: normalizeFieldMap(config?.fieldMap),
  popupFields: Array.isArray(config?.popupFields) ? config.popupFields : [],
  filterFields: Array.isArray(config?.filterFields) ? config.filterFields : [],
});

const normalizeTab = (
  tab: Partial<TimelineTab> | null | undefined,
): TimelineTab | null => {
  if (!tab || typeof tab !== "object") return null;

  return {
    id: typeof tab.id === "string" && tab.id ? tab.id : createTabId(),
    label:
      typeof tab.label === "string" && tab.label.trim()
        ? tab.label
        : getDefaultTabLabel({
            spreadsheetName: tab.spreadsheetName,
            sheetName: tab.sheetName,
          }),
    spreadsheetId:
      typeof tab.spreadsheetId === "string" ? tab.spreadsheetId : "",
    spreadsheetName:
      typeof tab.spreadsheetName === "string" ? tab.spreadsheetName : "",
    spreadsheetUrl:
      typeof tab.spreadsheetUrl === "string" ? tab.spreadsheetUrl : "",
    sheetName: typeof tab.sheetName === "string" ? tab.sheetName : "",
    configured: tab.configured === true,
    config: normalizeConfig(tab.config),
  };
};

/** Repairs anything read back from storage: missing keys, corrupt tabs, dangling activeTabId. */
export const normalizeWorkspace = (raw: unknown): WorkspaceState => {
  const candidate = raw as Partial<WorkspaceState> | null;

  const tabs = Array.isArray(candidate?.tabs)
    ? candidate.tabs
        .map(normalizeTab)
        .filter((tab): tab is TimelineTab => tab !== null)
    : [];

  if (tabs.length === 0) return createWorkspace();

  const activeTabId = tabs.some((tab) => tab.id === candidate?.activeTabId)
    ? (candidate!.activeTabId as string)
    : tabs[0].id;

  return { version: WORKSPACE_VERSION, activeTabId, tabs };
};

export const parseWorkspace = (
  json: string | null | undefined,
): WorkspaceState => {
  if (!json) return createWorkspace();
  try {
    return normalizeWorkspace(JSON.parse(json));
  } catch {
    return createWorkspace();
  }
};

export const addTab = (
  workspace: WorkspaceState,
  tab: TimelineTab = createTab(),
): WorkspaceState => ({
  ...workspace,
  activeTabId: tab.id,
  tabs: [...workspace.tabs, tab],
});

/** Closing the last tab leaves a fresh empty one so the app is never tabless. */
export const closeTab = (
  workspace: WorkspaceState,
  tabId: string,
): WorkspaceState => {
  const index = workspace.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return workspace;

  const tabs = workspace.tabs.filter((tab) => tab.id !== tabId);
  if (tabs.length === 0) return createWorkspace();

  const activeTabId =
    workspace.activeTabId === tabId
      ? tabs[Math.min(index, tabs.length - 1)].id
      : workspace.activeTabId;

  return { ...workspace, activeTabId, tabs };
};

export const updateTab = (
  workspace: WorkspaceState,
  tabId: string,
  updater: (tab: TimelineTab) => TimelineTab,
): WorkspaceState => ({
  ...workspace,
  tabs: workspace.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
});

export const renameTab = (
  workspace: WorkspaceState,
  tabId: string,
  label: string,
): WorkspaceState =>
  updateTab(workspace, tabId, (tab) => ({
    ...tab,
    label: label.trim() || tab.label,
  }));

export const setActiveTab = (
  workspace: WorkspaceState,
  tabId: string,
): WorkspaceState =>
  workspace.tabs.some((tab) => tab.id === tabId)
    ? { ...workspace, activeTabId: tabId }
    : workspace;

export const getActiveTab = (workspace: WorkspaceState): TimelineTab =>
  workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ||
  workspace.tabs[0];
