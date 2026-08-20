import React, { useEffect, useRef, useState } from "react";
import type { TimelineTab } from "../utils/workspace";
import { cn } from "../utils/cn";
import { MdAddBox, MdClose, MdEdit } from "react-icons/md";
import { Button, TextInput } from "./ui";

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
            className={cn(
              "group flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 text-sm",
              isActive
                ? "border-border bg-card font-medium"
                : "border-transparent bg-transparent text-muted-foreground hover:bg-card/60",
            )}
          >
            {editingId === tab.id ? (
              <TextInput
                inputRef={inputRef}
                value={draft}
                onChange={setDraft}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitRename();
                  if (event.key === "Escape") setEditingId(null);
                }}
                className="w-32 px-1 py-0.5"
              />
            ) : (
              <>
                <Button
                  variant="text"
                  onClick={() => onSelect(tab.id)}
                  title={tab.spreadsheetName || "No spreadsheet selected"}
                  className="max-w-45 cursor-pointer truncate"
                >
                  {tab.label}
                </Button>
                <Button
                  variant="icon"
                  onClick={() => startRename(tab)}
                  ariaLabel={`Edit label for ${tab.label}`}
                  title="Edit tab label"
                  className="opacity-0 focus:opacity-100 group-hover:opacity-100"
                >
                  <MdEdit />
                </Button>
              </>
            )}
            <Button
              variant="icon"
              onClick={() => requestClose(tab)}
              title="Close"
              ariaLabel={`Close ${tab.label}`}
              className="opacity-0 focus:opacity-100 group-hover:opacity-100"
            >
              <MdClose />
            </Button>
          </div>
        );
      })}

      <Button
        variant="ghost"
        onClick={onCreate}
        ariaLabel="New timeline tab"
        title="New timeline tab"
        className="mb-1 shrink-0 rounded-md px-2 py-1 text-lg leading-none"
      >
        <MdAddBox />
      </Button>
    </div>
  );
};
