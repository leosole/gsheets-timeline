import React from "react";
import type { Granularity } from "../utils/date-utils";
import { Button, Select, StatusPill, TextInput, ToggleGroup } from "./ui";

interface ControlsProps {
  filter: string;
  onFilterChange: (value: string) => void;
  granularity: Granularity;
  onGranularityChange: (value: Granularity) => void;
  scrollToToday: () => void;
  showCurrentDateBtn: boolean;
  statusFilter: string[];
  onStatusFilterChange: (value: string[]) => void;
  extraFieldFilters: Record<string, string>;
  onExtraFieldFilterChange: (field: string, value: string) => void;
  filterOptions: Record<string, string[]>;
  statusOptions: string[];
}

export const Controls: React.FC<ControlsProps> = ({
  filter,
  onFilterChange,
  granularity,
  onGranularityChange,
  scrollToToday,
  showCurrentDateBtn,
  statusFilter,
  onStatusFilterChange,
  extraFieldFilters,
  onExtraFieldFilterChange,
  filterOptions,
  statusOptions,
}) => {
  const toggleStatus = (s: string) => {
    if (statusFilter.includes(s)) {
      onStatusFilterChange(statusFilter.filter((x) => x !== s));
    } else {
      onStatusFilterChange([...statusFilter, s]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-card border-b border-border">
      <TextInput
        value={filter}
        onChange={onFilterChange}
        placeholder="Filtrar tarefas..."
        className="w-48 px-3 py-1.5"
      />

      {statusOptions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map((s) => (
            <StatusPill
              key={s}
              onClick={() => toggleStatus(s)}
              selected={statusFilter.includes(s)}
              showCheck={statusFilter.includes(s)}
              label={s}
            />
          ))}
        </div>
      )}

      {Object.entries(filterOptions).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(filterOptions).map(([field, values]) => (
            <Select
              key={field}
              value={extraFieldFilters[field] || ""}
              onChange={(value) => onExtraFieldFilterChange(field, value)}
              options={[{ value: "", label: field }, ...values]}
              className="px-2 py-1.5 text-xs"
            />
          ))}
        </div>
      )}

      <ToggleGroup
        value={granularity}
        onChange={onGranularityChange}
        options={[
          { value: "day", label: "Dia" },
          { value: "week", label: "Semana" },
          { value: "month", label: "Mês" },
        ]}
      />

      {showCurrentDateBtn && (
        <Button
          onClick={scrollToToday}
          variant="primary"
          size="sm"
          className="text-xs hover:bg-primary-hover"
        >
          Hoje
        </Button>
      )}
    </div>
  );
};
