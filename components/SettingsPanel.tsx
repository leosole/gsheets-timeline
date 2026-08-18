import React, { useEffect, useState } from "react";
import type { SpreadsheetConfig } from "../utils/sheetConfig";
import { fetchSpreadsheetMeta } from "../utils/sheetHost";
import { pickSpreadsheet } from "../utils/picker";
import type { SheetSelection, TimelineTab } from "../utils/workspace";

interface SettingsPanelProps {
  tab: TimelineTab;
  fieldOptions: string[];
  metadataFields: string[];
  allowPicker: boolean;
  onConfigChange: React.Dispatch<React.SetStateAction<SpreadsheetConfig>>;
  onSelectionChange: (selection: SheetSelection) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  tab,
  fieldOptions,
  metadataFields,
  allowPicker,
  onConfigChange,
  onSelectionChange,
}) => {
  const config = tab.config;
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { spreadsheetId } = tab;

  useEffect(() => {
    if (!spreadsheetId) {
      setSheetNames([]);
      return;
    }

    let cancelled = false;
    fetchSpreadsheetMeta(spreadsheetId)
      .then((meta) => {
        if (!cancelled) setSheetNames(meta.sheetNames);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [spreadsheetId]);

  const handlePick = async () => {
    setError(null);
    try {
      const picked = await pickSpreadsheet();
      if (picked) onSelectionChange({ ...picked, sheetName: "" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const updateFieldSelection = (
    key: "name" | "start" | "end" | "due",
    value: string,
  ) => {
    onConfigChange((current) => ({
      ...current,
      fieldMap: { ...current.fieldMap, [key]: value },
    }));
  };

  const toggleSelectionList = (
    field: "popupFields" | "filterFields",
    value: string,
  ) => {
    onConfigChange((current) => {
      const existing = current[field] || [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...current, [field]: next };
    });
  };

  return (
    <div className="space-y-4 p-4">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Spreadsheet
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {allowPicker ? (
            <button
              type="button"
              onClick={() => void handlePick()}
              className="cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
            >
              {tab.spreadsheetId ? "Change…" : "Choose…"}
            </button>
          ) : null}
          <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {tab.spreadsheetName || "No spreadsheet selected"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Sheet
        </label>
        <select
          value={tab.sheetName}
          disabled={sheetNames.length === 0}
          onChange={(event) =>
            onSelectionChange({
              spreadsheetId: tab.spreadsheetId,
              spreadsheetName: tab.spreadsheetName,
              spreadsheetUrl: tab.spreadsheetUrl,
              sheetName: event.target.value,
            })
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        >
          <option value="">Select a sheet</option>
          {sheetNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Timeline title
        </label>
        <input
          value={config.title}
          onChange={(event) =>
            onConfigChange((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Project timeline"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Status column
        </label>
        <select
          value={config.statusField || ""}
          onChange={(event) =>
            onConfigChange((current) => ({
              ...current,
              statusField: event.target.value,
            }))
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">None</option>
          {fieldOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ["name", "Name column"],
            ["start", "Start date"],
            ["end", "End date"],
            ["due", "Due date"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </label>
            <select
              value={config.fieldMap[key]}
              onChange={(event) =>
                updateFieldSelection(key, event.target.value)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a column</option>
              {fieldOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {(["popupFields", "filterFields"] as const).map((field) => (
        <div key={field} className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {field === "popupFields" ? "Popup extra fields" : "Filter fields"}
          </label>
          <div className="flex flex-wrap gap-2">
            {metadataFields.map((option) => (
              <label
                key={option}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={config[field].includes(option)}
                  onChange={() => toggleSelectionList(field, option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
