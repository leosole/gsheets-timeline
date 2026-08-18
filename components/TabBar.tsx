import React, { useEffect, useRef, useState } from "react";
import type { TimelineTab } from "../utils/workspace";
import { MdAddBox, MdClose, MdEdit } from "react-icons/md";

interface TabBarProps {
  tabs: TimelineTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onRename: (tabId: string, label: string) => void;
  onCreate: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onRename,
  onCreate,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  const startRename = (tab: TimelineTab) => {
    setEditingId(tab.id);
    setDraft(tab.label);
  };

  const commitRename = () => {
    if (editingId) onRename(editingId, draft);
    setEditingId(null);
  };

  const requestClose = (tab: TimelineTab) => {
    const isConfigured = Boolean(tab.spreadsheetId);
    if (isConfigured && !window.confirm(`Close "${tab.label}"?`)) return;
    onClose(tab.id);
  };

  return (
    <div className="flex items-end gap-1 overflow-x-auto border-b border-border bg-muted/40 px-2 pt-2">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm ${
              isActive
                ? "border-border bg-card font-medium"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-card/60"
            }`}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") setEditingId(null);
                }}
                className="w-32 rounded border border-border bg-background px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(tab.id)}
                  title={tab.spreadsheetName || "No spreadsheet selected"}
                  className="max-w-45 cursor-pointer truncate"
                >
                  {tab.label}
                </button>
                <button
                  type="button"
                  onClick={() => startRename(tab)}
                  aria-label={`Edit label for ${tab.label}`}
                  title="Edit tab label"
                  className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                >
                  <MdEdit />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => requestClose(tab)}
              title="Close"
              aria-label={`Close ${tab.label}`}
              className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
            >
              <MdClose />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={onCreate}
        aria-label="New timeline tab"
        title="New timeline tab"
        className="mb-1 shrink-0 cursor-pointer rounded-md px-2 py-1 text-lg leading-none text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MdAddBox />
      </button>
    </div>
  );
};
