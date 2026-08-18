import React from "react";
import { MdLightMode, MdNightlight, MdSync } from "react-icons/md";

type ViewMode = "timeline" | "settings";

interface AppHeaderProps {
  viewMode: ViewMode;
  dark: boolean;
  loading: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onDarkModeToggle: () => void;
  onSync: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  viewMode,
  dark,
  loading,
  onViewModeChange,
  onDarkModeToggle,
  onSync,
}) => (
  <div className="border-b border-border bg-card">
    <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="text-lg font-bold">Timeline</div>
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(["settings", "timeline"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors cursor-pointer ${
                viewMode === mode
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "timeline" ? "Timeline" : "Configuration"}
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
            {dark ? <MdLightMode /> : <MdNightlight />}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={loading}
            className="ml-auto cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted disabled:animate-pulse disabled:opacity-50"
            title="Sync data"
          >
            <MdSync />
          </button>
        </div>
      </div>
    </div>
  </div>
);
