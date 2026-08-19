import React, { useState, useRef, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { Controls } from "./Controls";
import { Legend } from "./Legend";
import { TaskBar } from "./TaskBar";
import { TaskPopover } from "./TaskPopover";
import { TimelineHeader } from "./TimelineHeader";
import {
  calculateDateRange,
  generateTimelineData,
  getCurrentDatePosition,
  getDaySize,
} from "../utils/dateUtils";
import { getTaskStatuses } from "../utils/barMetrics";
import type { Granularity } from "../utils/dateUtils";
import { BiCollapseVertical, BiExpandVertical } from "react-icons/bi";
import { PiCaretDownBold } from "react-icons/pi";

interface TimelineProps {
  tasks: any[];
  title?: string;
  filterFields?: string[];
  popupFields?: string[];
  sheetUrl?: string | null;
  statusField?: string;
  generatedAt?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  tasks,
  title = "Timeline",
  filterFields = [],
  popupFields = [],
  sheetUrl,
  statusField,
  generatedAt,
}) => {
  const [filter, setFilter] = useState("");
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [mouseDatePx, setMouseDatePx] = useState<number | undefined>();
  const [showCurrentDateBtn, setShowCurrentDateBtn] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [extraFieldFilters, setExtraFieldFilters] = useState<
    Record<string, string>
  >({});
  const [statusColors, setStatusColors] = useState<Record<string, string>>({});
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(
    () => new Set(),
  );

  const dateRange = calculateDateRange(tasks);
  const timelineData = generateTimelineData(dateRange, granularity);
  const currentDatePx = getCurrentDatePosition(timelineData);
  const isCurrentDateVisible =
    currentDatePx >= 0 &&
    currentDatePx <= timelineData.totalDays * timelineData.daySize;
  const daySize = getDaySize(granularity);

  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Compute filter options from tasks (excluding metadata columns that should never be filters)
  const filterOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    if (!filterFields.length) return opts;
    const coreFields = new Set(["name", "start", "end", "due", "status"]);
    filterFields.forEach((f) => {
      if (coreFields.has(f.toLowerCase())) return;
      opts[f] = [
        ...new Set(tasks.map((t) => String(t[f] ?? "")).filter(Boolean)),
      ].sort();
    });
    return opts;
  }, [tasks, filterFields]);

  const statusOptions = useMemo(() => {
    const values = new Set<string>();
    if (statusField) {
      tasks.forEach((task) => {
        const value = task[statusField];
        if (value !== undefined && value !== null && String(value).trim()) {
          values.add(String(value).trim());
        }
      });
    }
    return Array.from(values).sort();
  }, [tasks, statusField]);

  useEffect(() => {
    const handleStatusColor = (event: Event) => {
      const detail = (event as CustomEvent<{ label: string; color: string }>)
        .detail;
      if (!detail) return;
      setStatusColors((prev) => ({ ...prev, [detail.label]: detail.color }));
    };
    window.addEventListener("timeline:status-color-change", handleStatusColor);
    return () =>
      window.removeEventListener(
        "timeline:status-color-change",
        handleStatusColor,
      );
  }, []);

  // Initialize random colors for custom status options
  useEffect(() => {
    if (statusField && statusOptions.length > 0) {
      setStatusColors((prev) => {
        const colors = { ...prev };
        statusOptions.forEach((option, index) => {
          if (!colors[option]) {
            const randomHue =
              (index * 63 + Math.floor(Math.random() * 30)) % 360;
            colors[option] = `hsl(${randomHue} 70% 60%)`;
          }
        });
        return colors;
      });
    }
  }, [statusField, statusOptions.join(",")]);

  const handleExtraFieldFilter = (field: string, value: string) => {
    setExtraFieldFilters((prev) => {
      const next = { ...prev };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
  };

  const getTaskStatusMatches = (task: any): string[] => {
    if (
      statusField &&
      task[statusField] !== undefined &&
      task[statusField] !== null &&
      String(task[statusField]).trim()
    ) {
      return [String(task[statusField]).trim()];
    }
    return getTaskStatuses(task);
  };

  const taskMatchesFilters = (task: any): boolean => {
    if (
      statusFilter.length > 0 &&
      !statusFilter.some((status) =>
        getTaskStatusMatches(task).includes(status),
      )
    ) {
      return false;
    }

    for (const [field, value] of Object.entries(extraFieldFilters)) {
      if (String(task[field] ?? "") !== value) return false;
    }

    return String(task.name ?? "")
      .toLowerCase()
      .includes(filter.toLowerCase());
  };

  const groupedParentRows = useMemo(() => {
    const parents = new Set<number>();

    tasks.forEach((task) => {
      if (typeof task.__groupParentRow === "number") {
        parents.add(task.__groupParentRow);
      }

      if (
        task.__isGroupParent &&
        typeof task.__sheetRow === "number" &&
        Number(task.__groupChildCount || 0) > 0
      ) {
        parents.add(task.__sheetRow);
      }
    });

    return parents;
  }, [tasks]);
  const hasGroupedRows = groupedParentRows.size > 0;

  const initialCollapsedParents = useMemo(() => {
    const rows = new Set<number>();

    tasks.forEach((task) => {
      if (
        task.__isGroupParent &&
        typeof task.__sheetRow === "number" &&
        task.__groupCollapsed
      ) {
        rows.add(task.__sheetRow);
      }
    });

    return rows;
  }, [tasks]);
  const initialCollapsedKey = Array.from(initialCollapsedParents).join(",");

  useEffect(() => {
    if (!hasGroupedRows) {
      setCollapsedParents(new Set());
      return;
    }

    setCollapsedParents(initialCollapsedParents);
  }, [hasGroupedRows, initialCollapsedKey]);

  const hasActiveFilters =
    statusFilter.length > 0 ||
    Object.keys(extraFieldFilters).length > 0 ||
    filter.trim().length > 0;

  const matchingChildParentRows =
    hasGroupedRows && hasActiveFilters
      ? tasks.reduce((rows: Set<number>, task) => {
          if (
            typeof task.__groupParentRow === "number" &&
            taskMatchesFilters(task)
          ) {
            rows.add(task.__groupParentRow);
          }
          return rows;
        }, new Set<number>())
      : new Set<number>();

  const effectiveCollapsedParents = new Set<number>(collapsedParents);
  matchingChildParentRows.forEach((row) => {
    effectiveCollapsedParents.delete(row);
  });

  const displayedTasks = hasGroupedRows
    ? tasks.filter((task) => {
        const rowParent =
          typeof task.__groupParentRow === "number"
            ? task.__groupParentRow
            : -1;

        if (rowParent >= 0) {
          if (effectiveCollapsedParents.has(rowParent)) return false;
          return taskMatchesFilters(task);
        }

        const rowNumber =
          typeof task.__sheetRow === "number" ? task.__sheetRow : -1;
        const hasChildren = rowNumber >= 0 && groupedParentRows.has(rowNumber);

        if (!hasChildren) {
          return taskMatchesFilters(task);
        }

        if (taskMatchesFilters(task)) return true;
        return rowNumber >= 0 && matchingChildParentRows.has(rowNumber);
      })
    : tasks
        .filter(taskMatchesFilters)
        .sort(
          (a, b) =>
            (a.start ? parseInt(a.start.replace(/\//g, "")) : 0) -
            (b.start ? parseInt(b.start.replace(/\//g, "")) : 0),
        );

  // Scroll to current date on mount
  useEffect(() => {
    if (isCurrentDateVisible && timelineScrollRef.current) {
      const container = timelineScrollRef.current;
      const targetLeft = currentDatePx - container.clientWidth / 2;
      container.scrollLeft = Math.max(0, targetLeft);
    }
  }, [granularity]);

  const scrollToToday = () => {
    if (timelineScrollRef.current && isCurrentDateVisible) {
      const container = timelineScrollRef.current;
      const targetLeft = currentDatePx - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }
  };

  const handleTimelineScroll = () => {
    if (timelineScrollRef.current && isCurrentDateVisible) {
      const c = timelineScrollRef.current;
      const scrollLeft = c.scrollLeft;
      const visLeft = currentDatePx - timelineData.daySize * 2;
      const visRight = currentDatePx + timelineData.daySize * 2;
      setShowCurrentDateBtn(
        !(scrollLeft <= visLeft && scrollLeft + c.clientWidth >= visRight),
      );
    } else {
      setShowCurrentDateBtn(false);
    }
  };

  const rowHeight = 40;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-background">
      <header className="shrink-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          {sheetUrl ? (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xl font-bold hover:underline"
            >
              {title}
            </a>
          ) : (
            <h1 className="text-xl font-bold">{title}</h1>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Gerado: {generatedAt}
          </p>
        </div>
      </header>

      <Controls
        filter={filter}
        onFilterChange={setFilter}
        granularity={granularity}
        onGranularityChange={setGranularity}
        scrollToToday={scrollToToday}
        showCurrentDateBtn={showCurrentDateBtn}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        extraFieldFilters={extraFieldFilters}
        onExtraFieldFilterChange={handleExtraFieldFilter}
        filterOptions={filterOptions}
        statusOptions={statusOptions}
      />

      <div
        ref={timelineScrollRef}
        className="relative min-h-0 flex-1 overflow-auto"
        onScroll={handleTimelineScroll}
      >
        <div
          className="flex"
          style={{
            width: `max(100%, ${288 + timelineData.totalDays * daySize}px)`,
          }}
        >
          {/* Sidebar (frozen first column) */}
          <div className="sticky left-0 z-30 w-72 shrink-0 border-r border-border bg-background flex flex-col">
            <div className="sticky top-0 z-30 h-16 border-b border-border bg-muted shrink-0 flex items-center justify-between px-4">
              <span className="font-semibold text-sm text-foreground">
                Tarefas
              </span>
              {hasGroupedRows ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCollapsedParents(new Set())}
                    className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    title="Expand all"
                    aria-label="Expand all"
                  >
                    <BiExpandVertical />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedParents(new Set(groupedParentRows))
                    }
                    className="cursor-pointer rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    title="Collapse all"
                    aria-label="Collapse all"
                  >
                    <BiCollapseVertical />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="divide-y divide-border">
              {displayedTasks.map((task, idx) => (
                <div
                  key={task.__sheetRow ?? idx}
                  className="h-10 flex items-center px-4 text-sm hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  {(() => {
                    const rowNumber =
                      typeof task.__sheetRow === "number"
                        ? task.__sheetRow
                        : -1;
                    const isChild = typeof task.__groupParentRow === "number";
                    const hasChildren =
                      rowNumber >= 0 && groupedParentRows.has(rowNumber);
                    const isCollapsed =
                      rowNumber >= 0 &&
                      effectiveCollapsedParents.has(rowNumber);

                    return (
                      <div className="flex min-w-0 items-center">
                        {hasChildren ? (
                          <button
                            type="button"
                            className="mr-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-muted/60"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCollapsedParents((previous) => {
                                const next = new Set(previous);
                                if (next.has(rowNumber)) {
                                  next.delete(rowNumber);
                                } else {
                                  next.add(rowNumber);
                                }
                                return next;
                              });
                            }}
                            aria-label={
                              isCollapsed ? "Expandir grupo" : "Recolher grupo"
                            }
                          >
                            <PiCaretDownBold
                              className={`transition-transform duration-200 ${isCollapsed ? "rotate-0" : "rotate-180"}`}
                            />
                          </button>
                        ) : (
                          <span className="mr-1 inline-block h-5 w-5 shrink-0" />
                        )}
                        <span className={`truncate ${isChild ? "ml-3" : ""}`}>
                          {task.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
              {displayedTasks.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground italic">
                  Nenhuma tarefa encontrada
                </div>
              )}
            </div>
          </div>

          {/* Timeline area (frozen header) */}
          <div
            className="relative shrink-0"
            style={{
              width: `${timelineData.totalDays * daySize}px`,
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMouseDatePx(e.clientX - rect.left);
            }}
            onMouseLeave={() => setMouseDatePx(undefined)}
          >
            <div className="sticky top-0 z-20 bg-muted">
              <TimelineHeader
                timelineData={timelineData}
                granularity={granularity}
                daySize={daySize}
              />

              {isCurrentDateVisible &&
                (granularity === "week" || granularity === "month") && (
                  <div
                    className="absolute z-30 flex h-5 w-5 items-center justify-center rounded-full bg-timeline-today text-xs font-bold text-white pointer-events-none"
                    style={{ left: `${currentDatePx - 10}px`, top: "50px" }}
                  >
                    {dayjs().date()}
                  </div>
                )}
            </div>

            {displayedTasks.map((task, idx) => (
              <div
                key={task.__sheetRow ?? idx}
                className="h-10 relative hover:bg-muted/30 flex items-center border-b border-border"
              >
                <TaskBar
                  task={task}
                  timelineData={timelineData}
                  granularity={granularity}
                  onSelect={setSelectedTask}
                  statusField={statusField}
                  statusColors={statusColors}
                />
              </div>
            ))}

            {isCurrentDateVisible && (
              <div
                className="absolute z-0 w-0.5 bg-timeline-today pointer-events-none"
                style={{
                  left: `${currentDatePx}px`,
                  top: "64px",
                  height: `${Math.max(displayedTasks.length * rowHeight, 24)}px`,
                }}
              />
            )}

            {mouseDatePx !== undefined && (
              <div
                className="absolute z-0 w-px bg-secondary pointer-events-none"
                style={{
                  left: `${mouseDatePx}px`,
                  top: "64px",
                  height: `${Math.max(displayedTasks.length * rowHeight, 24)}px`,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 z-40 bg-muted">
        <Legend
          statusOptions={statusOptions}
          statusColors={statusColors}
          hasCustomStatusField={Boolean(statusField)}
        />
      </div>

      {selectedTask && (
        <TaskPopover
          task={selectedTask}
          popupFields={popupFields}
          onClose={() => setSelectedTask(null)}
          statusField={statusField}
          statusColors={statusColors}
        />
      )}
    </div>
  );
};
