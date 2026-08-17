import React from "react";
import type { SpreadsheetConfig } from "../utils/sheetConfig";

interface SettingsPanelProps {
  config: SpreadsheetConfig;
  fieldOptions: string[];
  metadataFields: string[];
  onConfigChange: React.Dispatch<React.SetStateAction<SpreadsheetConfig>>;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  config,
  fieldOptions,
  metadataFields,
  onConfigChange,
}) => {
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
