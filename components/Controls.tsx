import React from "react";
import type { Granularity } from "../utils/dateUtils";

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
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder="Filtrar tarefas..."
        className="px-3 py-1.5 border border-border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary w-48"
      />

      {statusOptions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                statusFilter.includes(s)
                  ? "bg-primary text-white border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              {statusFilter.includes(s) ? "✓ " : ""}
              {s}
            </button>
          ))}
        </div>
      )}

      {Object.entries(filterOptions).length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(filterOptions).map(([field, values]) => (
            <select
              key={field}
              value={extraFieldFilters[field] || ""}
              onChange={(e) => onExtraFieldFilterChange(field, e.target.value)}
              className="px-2 py-1.5 border border-border rounded bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{field}</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}

      <div className="flex rounded-lg border border-border bg-background p-0.5 gap-0.5">
        {(["day", "week", "month"] as const).map((g) => (
          <button
            key={g}
            onClick={() => onGranularityChange(g)}
            className={`px-3 py-1 text-xs rounded-md transition-colors cursor-pointer ${
              granularity === g
                ? "bg-primary text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g === "day" ? "Dia" : g === "week" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      {showCurrentDateBtn && (
        <button
          onClick={scrollToToday}
          className="text-xs text-white bg-primary hover:bg-primary-hover px-3 py-1 rounded-md cursor-pointer"
        >
          Hoje
        </button>
      )}
    </div>
  );
};
