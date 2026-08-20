import React from "react";
import { MdLightMode, MdNightlight, MdSync } from "react-icons/md";
import { Button, ToggleGroup } from "./ui";

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
        <ToggleGroup
          className="p-1"
          itemClassName="rounded-md px-3 py-1.5 text-sm transition-colors"
          value={viewMode}
          onChange={onViewModeChange}
          options={[
            { value: "settings", label: "Configuration" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
        <div>
          <Button
            variant="ghost"
            onClick={onDarkModeToggle}
            className="p-2"
            title={dark ? "Light mode" : "Dark mode"}
          >
            {dark ? <MdLightMode /> : <MdNightlight />}
          </Button>
          <Button
            variant="ghost"
            onClick={onSync}
            disabled={loading}
            className="ml-auto p-2 disabled:animate-pulse"
            title="Sync data"
          >
            <MdSync />
          </Button>
        </div>
      </div>
    </div>
  </div>
);
