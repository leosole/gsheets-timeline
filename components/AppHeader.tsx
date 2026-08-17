import React from "react";

type TabName = "timeline" | "settings";

interface AppHeaderProps {
  activeTab: TabName;
  dark: boolean;
  onTabChange: (tab: TabName) => void;
  onDarkModeToggle: () => void;
  onSync: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  dark,
  onTabChange,
  onDarkModeToggle,
  onSync,
}) => (
  <div className="border-b border-border bg-card">
    <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="text-lg font-bold">Timeline</div>
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(["settings", "timeline"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                activeTab === tab
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "timeline" ? "Timeline" : "Configuration"}
            </button>
          ))}
        </div>
        <div>
          <button
            type="button"
            onClick={onDarkModeToggle}
            className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted"
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={onSync}
            className="ml-auto cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted"
            title="Sync data"
          >
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 24 24"
              height="20px"
              width="20px"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path fill="none" d="M0 0h24v24H0z" />
              <path d="M11 8v5l4.25 2.52.77-1.28-3.52-2.09V8zm10 2V3l-2.64 2.64A8.94 8.94 0 0 0 12 3a9 9 0 1 0 9 9h-2c0 3.86-3.14 7-7 7s-7-3.14-7-7 3.14-7 7-7c1.93 0 3.68.79 4.95 2.05L14 10z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
);
