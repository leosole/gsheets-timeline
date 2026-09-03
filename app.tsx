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
import {
  getCachedEmail,
  isAuthenticated,
  isEmailAllowed,
  isVercelMode,
  requestAccessToken,
  signOut,
} from "./utils/vercel-auth";

const SAVE_DEBOUNCE_MS = 800;

type AuthState = "loading" | "signed-out" | "unauthorized" | "authorized";

export const App: React.FC = () => {
  const bootstrap = useRef(getBootstrap()).current;
  const isAddon = bootstrap.mode === "addon";

  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Vercel mode: auth state tracks sign-in + email allowlist.
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (!isVercelMode()) return "authorized";
    if (!isAuthenticated()) return "signed-out";
    return "loading"; // will check allowlist async below
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(
    isVercelMode() ? getCachedEmail() : null,
  );

  // On mount, if we have a cached token, verify the email against the allowlist.
  useEffect(() => {
    if (authState !== "loading") return;
    const email = getCachedEmail();
    setUserEmail(email);
    isEmailAllowed(email).then((allowed) => {
      setAuthState(allowed ? "authorized" : "unauthorized");
    });
  }, [authState]);

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

  // Load workspace once authorized (or immediately in non-Vercel modes).
  useEffect(() => {
    if (authState !== "authorized") return;

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
  }, [authState, isAddon, bootstrap.bound]);

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

  // --- Vercel mode: Google sign-in gate ---
  if (isVercelMode() && authState === "signed-out") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex max-w-sm flex-col items-center gap-6 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-2xl font-bold">Timeline</div>
          <p className="text-sm text-muted-foreground">
            Sign in with your Google account to access your spreadsheets.
          </p>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : null}
          <button
            type="button"
            disabled={authLoading}
            onClick={() => {
              setAuthLoading(true);
              setLoadError(null);
              requestAccessToken()
                .then(async () => {
                  const email = getCachedEmail();
                  setUserEmail(email);
                  const allowed = await isEmailAllowed(email);
                  setAuthState(allowed ? "authorized" : "unauthorized");
                })
                .catch((cause: unknown) => {
                  setLoadError(
                    cause instanceof Error ? cause.message : String(cause),
                  );
                })
                .finally(() => setAuthLoading(false));
            }}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-5 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {authLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Sign in with Google
          </button>
          <p className="text-xs text-muted-foreground">
            Your data stays in your Google account. We only read spreadsheets
            you choose.
          </p>
        </div>
      </div>
    );
  }

  // --- Vercel mode: unauthorized email ---
  if (isVercelMode() && authState === "unauthorized") {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <div className="text-4xl">🔒</div>
          <div className="text-xl font-bold">Access Denied</div>
          <p className="text-sm text-muted-foreground">
            Your Google account
            {userEmail ? (
              <>
                {" "}
                <span className="font-medium text-foreground">{userEmail}</span>
              </>
            ) : null}{" "}
            is not authorized to use this application.
          </p>
          <p className="text-xs text-muted-foreground">
            Contact the administrator to request access.
          </p>
          <button
            type="button"
            onClick={() => {
              signOut();
              setAuthState("signed-out");
              setUserEmail(null);
            }}
            className="mt-2 cursor-pointer rounded-md border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    );
  }

  // --- Normal app (Apps Script, Vercel after auth, or local dev) ---
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
