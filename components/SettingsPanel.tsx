import React, { useEffect, useMemo, useState } from "react";
import type { SpreadsheetConfig } from "../utils/sheetConfig";
import { fetchSpreadsheetMeta } from "../utils/sheetHost";
import { pickSpreadsheet } from "../utils/picker";
import type { SheetSelection, TimelineTab } from "../utils/workspace";

interface SettingsPanelProps {
  tab: TimelineTab;
  fieldOptions: string[];
  allowPicker: boolean;
  loading: boolean;
  onConfigChange: React.Dispatch<React.SetStateAction<SpreadsheetConfig>>;
  onSelectionChange: (selection: SheetSelection) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  tab,
  fieldOptions,
  allowPicker,
  loading,
  onConfigChange,
  onSelectionChange,
}) => {
  const [draftConfig, setDraftConfig] = useState<SpreadsheetConfig>(
    tab.config,
  );
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { spreadsheetId } = tab;

  useEffect(() => {
    setDraftConfig(tab.config);
  }, [tab.config]);

  useEffect(() => {
    if (!spreadsheetId) {
      setSheetNames([]);
      setSheetLoading(false);
      return;
    }

    let cancelled = false;
    setSheetLoading(true);
    fetchSpreadsheetMeta(spreadsheetId)
      .then((meta) => {
        if (!cancelled) setSheetNames(meta.sheetNames);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setSheetLoading(false);
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
    setDraftConfig((current) => ({
      ...current,
      fieldMap: { ...current.fieldMap, [key]: value },
    }));
  };

  const toggleSelectionList = (
    field: "popupFields" | "filterFields",
    value: string,
  ) => {
    setDraftConfig((current) => {
      const existing = current[field] || [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...current, [field]: next };
    });
  };

  const metadataFields = useMemo(() => {
    const coreFields = new Set<string>(
      [
        draftConfig.fieldMap.name,
        draftConfig.fieldMap.start,
        draftConfig.fieldMap.end,
        draftConfig.fieldMap.due,
        draftConfig.statusField || "",
      ].filter(Boolean),
    );

    return fieldOptions.filter((option) => !coreFields.has(option));
  }, [draftConfig, fieldOptions]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draftConfig) !== JSON.stringify(tab.config),
    [draftConfig, tab.config],
  );

  const fieldOptionsLoading = loading && fieldOptions.length === 0;
  const disableFieldSelects = loading || fieldOptions.length === 0;
  const disableSheetSelect = loading || sheetLoading || sheetNames.length === 0;

  const handleSave = () => {
    onConfigChange(draftConfig);
  };

  const handleDiscard = () => {
    setDraftConfig(tab.config);
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

      {(loading || sheetLoading) && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
            aria-hidden="true"
          />
          <span>Loading configuration options...</span>
        </div>
      )}

      {hasUnsavedChanges ? (
        <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
          You have unsaved configuration changes. Save to apply them to the timeline.
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
              disabled={loading}
              onClick={() => void handlePick()}
              className="cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
          disabled={disableSheetSelect}
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
          {sheetLoading ? <option value="">Loading sheets...</option> : null}
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
          disabled={loading}
          value={draftConfig.title}
          onChange={(event) =>
            setDraftConfig((current) => ({
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
          disabled={disableFieldSelects}
          value={draftConfig.statusField || ""}
          onChange={(event) =>
            setDraftConfig((current) => ({
              ...current,
              statusField: event.target.value,
            }))
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">None</option>
          {fieldOptionsLoading ? <option value="">Loading columns...</option> : null}
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
              disabled={disableFieldSelects}
              value={draftConfig.fieldMap[key]}
              onChange={(event) =>
                updateFieldSelection(key, event.target.value)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Select a column</option>
              {fieldOptionsLoading ? <option value="">Loading columns...</option> : null}
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
                  disabled={loading}
                  type="checkbox"
                  checked={draftConfig[field].includes(option)}
                  onChange={() => toggleSelectionList(field, option)}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background px-4 py-3">
        <button
          type="button"
          disabled={loading || !hasUnsavedChanges}
          onClick={handleDiscard}
          className="cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard
        </button>
        <button
          type="button"
          disabled={loading || !hasUnsavedChanges}
          onClick={handleSave}
          className="cursor-pointer rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save configuration
        </button>
      </div>
    </div>
  );
};
