import React, { useCallback, useEffect, useRef, useState } from "react";
import { TabBar } from "./components/tab-bar";
import { TimelineTabView } from "./components/timeline-tab-view";
import {
  fetchWorkspace,
  getBootstrap,
  persistWorkspace,
} from "./utils/sheet-host";
import {
  addTab,
  closeTab,
  createTab,
  createWorkspace,
  getActiveTab,
  parseWorkspace,
  renameTab,
  setActiveTab,
  updateTab,
  type TimelineTab,
  type WorkspaceState,
} from "./utils/workspace";

const SAVE_DEBOUNCE_MS = 800;

export const App: React.FC = () => {
  const bootstrap = useRef(getBootstrap()).current;
  const isAddon = bootstrap.mode === "addon";

  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAddon && bootstrap.bound) {
      setWorkspace(
        createWorkspace([
          createTab({
            ...bootstrap.bound,
            label: bootstrap.bound.spreadsheetName,
          }),
        ]),
      );
      return;
    }

    fetchWorkspace()
      .then((json) => setWorkspace(parseWorkspace(json)))
      .catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? cause.message : String(cause));
        setWorkspace(createWorkspace());
      });
  }, [isAddon, bootstrap.bound]);

  // The addon is bound to one spreadsheet, so its state is never persisted.
  useEffect(() => {
    if (!workspace || isAddon) return;

    const timer = setTimeout(() => {
      persistWorkspace(JSON.stringify(workspace)).catch((cause: unknown) => {
        setLoadError(cause instanceof Error ? cause.message : String(cause));
      });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [workspace, isAddon]);

  const handleTabChange = useCallback(
    (tabId: string) => (updater: (tab: TimelineTab) => TimelineTab) => {
      setWorkspace((current) =>
        current ? updateTab(current, tabId, updater) : current,
      );
    },
    [],
  );

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading timelines…
      </div>
    );
  }

  const activeTab = getActiveTab(workspace);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {loadError ? (
        <div
          role="alert"
          className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {isAddon ? null : (
        <TabBar
          tabs={workspace.tabs}
          activeTabId={activeTab.id}
          onSelect={(tabId) =>
            setWorkspace((c) => (c ? setActiveTab(c, tabId) : c))
          }
          onClose={(tabId) => setWorkspace((c) => (c ? closeTab(c, tabId) : c))}
          onRename={(tabId, label) =>
            setWorkspace((c) => (c ? renameTab(c, tabId, label) : c))
          }
          onCreate={() => setWorkspace((c) => (c ? addTab(c) : c))}
        />
      )}

      <TimelineTabView
        key={activeTab.id}
        tab={activeTab}
        dark={dark}
        allowPicker={!isAddon}
        onDarkModeToggle={() => setDark((value) => !value)}
        onTabChange={handleTabChange(activeTab.id)}
      />
    </div>
  );
};

export default App;
