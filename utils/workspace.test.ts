import { describe, expect, it } from "vitest";
import { DEFAULT_FIELD_MAP } from "./sheetConfig";
import {
  addTab,
  closeTab,
  createTab,
  createWorkspace,
  getActiveTab,
  getDefaultTabLabel,
  parseWorkspace,
  renameTab,
  setActiveTab,
  updateTab,
} from "./workspace";

describe("createWorkspace", () => {
  it("starts with a single unconfigured tab that is active", () => {
    const workspace = createWorkspace();

    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.activeTabId).toBe(workspace.tabs[0].id);
    expect(workspace.tabs[0].spreadsheetId).toBe("");
    expect(workspace.tabs[0].configured).toBe(false);
  });
});

describe("addTab", () => {
  it("appends the new tab and focuses it", () => {
    const workspace = addTab(createWorkspace());

    expect(workspace.tabs).toHaveLength(2);
    expect(workspace.activeTabId).toBe(workspace.tabs[1].id);
  });
});

describe("closeTab", () => {
  it("moves focus to the neighbouring tab when the active one is closed", () => {
    const [first, second, third] = [createTab(), createTab(), createTab()];
    const workspace = setActiveTab(
      { ...createWorkspace([first, second, third]) },
      second.id,
    );

    const result = closeTab(workspace, second.id);

    expect(result.tabs.map((tab) => tab.id)).toEqual([first.id, third.id]);
    expect(result.activeTabId).toBe(third.id);
  });

  it("keeps focus when a background tab is closed", () => {
    const [first, second] = [createTab(), createTab()];
    const workspace = createWorkspace([first, second]);

    expect(closeTab(workspace, second.id).activeTabId).toBe(first.id);
  });

  it("replaces the last tab with a fresh empty one", () => {
    const workspace = createWorkspace();
    const result = closeTab(workspace, workspace.tabs[0].id);

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].id).not.toBe(workspace.tabs[0].id);
    expect(result.activeTabId).toBe(result.tabs[0].id);
  });

  it("ignores unknown tab ids", () => {
    const workspace = createWorkspace();
    expect(closeTab(workspace, "missing")).toBe(workspace);
  });
});

describe("renameTab", () => {
  it("trims the new label and keeps the old one when it is blank", () => {
    const workspace = createWorkspace([createTab({ label: "Roadmap" })]);
    const tabId = workspace.tabs[0].id;

    expect(renameTab(workspace, tabId, "  Q3 plan  ").tabs[0].label).toBe(
      "Q3 plan",
    );
    expect(renameTab(workspace, tabId, "   ").tabs[0].label).toBe("Roadmap");
  });

  it("uses the spreadsheet and sheet as the default tab label", () => {
    expect(
      getDefaultTabLabel({
        spreadsheetName: "Budget",
        sheetName: "Overview",
      }),
    ).toBe("Budget/Overview");
    expect(
      getDefaultTabLabel({ spreadsheetName: "Budget", sheetName: "" }),
    ).toBe("Budget");
  });
});

describe("updateTab", () => {
  it("only touches the targeted tab", () => {
    const [first, second] = [createTab(), createTab()];
    const workspace = createWorkspace([first, second]);

    const result = updateTab(workspace, second.id, (tab) => ({
      ...tab,
      sheetName: "Tasks",
    }));

    expect(result.tabs[0].sheetName).toBe("");
    expect(result.tabs[1].sheetName).toBe("Tasks");
  });
});

describe("parseWorkspace", () => {
  it("falls back to a fresh workspace for missing or corrupt storage", () => {
    expect(parseWorkspace("").tabs).toHaveLength(1);
    expect(parseWorkspace("not json").tabs).toHaveLength(1);
    expect(parseWorkspace('{"tabs":[]}').tabs).toHaveLength(1);
  });

  it("backfills missing tab fields and drops malformed entries", () => {
    const workspace = parseWorkspace(
      JSON.stringify({
        tabs: [{ id: "a", spreadsheetId: "abc" }, null, "nope"],
      }),
    );

    expect(workspace.tabs).toHaveLength(1);
    expect(workspace.tabs[0]).toMatchObject({
      id: "a",
      label: "New timeline",
      spreadsheetId: "abc",
      sheetName: "",
      configured: false,
    });
    expect(workspace.tabs[0].config.fieldMap).toEqual(DEFAULT_FIELD_MAP);
  });

  it("repairs an activeTabId that points at a removed tab", () => {
    const workspace = parseWorkspace(
      JSON.stringify({ activeTabId: "gone", tabs: [{ id: "a" }, { id: "b" }] }),
    );

    expect(workspace.activeTabId).toBe("a");
    expect(getActiveTab(workspace).id).toBe("a");
  });

  it("preserves a valid activeTabId", () => {
    const workspace = parseWorkspace(
      JSON.stringify({ activeTabId: "b", tabs: [{ id: "a" }, { id: "b" }] }),
    );

    expect(workspace.activeTabId).toBe("b");
  });
});

describe("setActiveTab", () => {
  it("ignores ids that are not in the workspace", () => {
    const workspace = createWorkspace();
    expect(setActiveTab(workspace, "missing")).toBe(workspace);
  });
});
