import React, { useEffect, useMemo, useState } from "react";
import type { SpreadsheetConfig } from "../utils/sheet-config";
import { fetchSpreadsheetMeta } from "../utils/sheet-host";
import { pickSpreadsheet } from "../utils/picker";
import type { SheetSelection, TimelineTab } from "../utils/workspace";
import {
  Alert,
  Button,
  CheckboxChip,
  FormField,
  Select,
  Spinner,
  TextInput,
} from "./ui";

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
  const [draftConfig, setDraftConfig] = useState<SpreadsheetConfig>(tab.config);
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
  const sheetSelectOptions = sheetLoading
    ? [{ value: "", label: "Loading sheets..." }]
    : sheetNames;
  const dynamicFieldOptions = fieldOptionsLoading
    ? [{ value: "", label: "Loading columns..." }]
    : fieldOptions;

  const handleSave = () => {
    onConfigChange(draftConfig);
  };

  const handleDiscard = () => {
    setDraftConfig(tab.config);
  };

  return (
    <div className="space-y-4 p-4">
      {error ? (
        <Alert type="error" role="alert">
          {error}
        </Alert>
      ) : null}

      {(loading || sheetLoading) && (
        <Alert type="muted" className="flex items-center gap-2" role="status">
          <Spinner />
          <span>Loading configuration options...</span>
        </Alert>
      )}

      {hasUnsavedChanges ? (
        <Alert type="info">
          You have unsaved configuration changes. Save to apply them to the
          timeline.
        </Alert>
      ) : null}

      <FormField label="Spreadsheet">
        <div className="flex flex-wrap items-center gap-2">
          {allowPicker ? (
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => void handlePick()}
            >
              {tab.spreadsheetId ? "Change…" : "Choose…"}
            </Button>
          ) : null}
          <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {tab.spreadsheetName || "No spreadsheet selected"}
          </span>
        </div>
      </FormField>

      <FormField label="Sheet">
        <Select
          value={tab.sheetName}
          disabled={disableSheetSelect}
          onChange={(value) =>
            onSelectionChange({
              spreadsheetId: tab.spreadsheetId,
              spreadsheetName: tab.spreadsheetName,
              spreadsheetUrl: tab.spreadsheetUrl,
              sheetName: value,
            })
          }
          options={sheetSelectOptions}
          placeholder="Select a sheet"
          className="w-full"
        />
      </FormField>

      <FormField label="Timeline title">
        <TextInput
          disabled={loading}
          value={draftConfig.title}
          onChange={(value) =>
            setDraftConfig((current) => ({
              ...current,
              title: value,
            }))
          }
          className="w-full"
          placeholder="Project timeline"
        />
      </FormField>

      <FormField label="Status column">
        <Select
          disabled={disableFieldSelects}
          value={draftConfig.statusField || ""}
          onChange={(value) =>
            setDraftConfig((current) => ({
              ...current,
              statusField: value,
            }))
          }
          options={dynamicFieldOptions}
          placeholder="None"
          className="w-full"
        />
      </FormField>

      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ["name", "Name column"],
            ["start", "Start date"],
            ["end", "End date"],
            ["due", "Due date"],
          ] as const
        ).map(([key, label]) => (
          <FormField key={key} label={label}>
            <Select
              disabled={disableFieldSelects}
              value={draftConfig.fieldMap[key]}
              onChange={(value) => updateFieldSelection(key, value)}
              options={dynamicFieldOptions}
              placeholder="Select a column"
              className="w-full"
            />
          </FormField>
        ))}
      </div>

      {(["popupFields", "filterFields"] as const).map((field) => (
        <FormField
          key={field}
          label={field === "popupFields" ? "Popup extra fields" : "Filter fields"}
        >
          <div className="flex flex-wrap gap-2">
            {metadataFields.map((option) => (
              <CheckboxChip
                key={option}
                disabled={loading}
                checked={draftConfig[field].includes(option)}
                onChange={() => toggleSelectionList(field, option)}
                label={option}
              />
            ))}
          </div>
        </FormField>
      ))}

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background px-4 py-3">
        <Button
          variant="secondary"
          disabled={loading || !hasUnsavedChanges}
          onClick={handleDiscard}
        >
          Discard
        </Button>
        <Button
          variant="primary"
          disabled={loading || !hasUnsavedChanges}
          onClick={handleSave}
        >
          Save configuration
        </Button>
      </div>
    </div>
  );
};
