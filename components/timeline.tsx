import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import dayjs from "dayjs";
import { cn } from "../utils/cn";
import { Controls } from "./controls";
import { Legend } from "./legend";
import { TaskBar } from "./task-bar";
import { TaskPopover } from "./task-popover";
import { TimelineHeader } from "./timeline-header";
import {
  calculateDateRange,
  generateTimelineData,
  getCurrentDatePosition,
  getDaySize,
} from "../utils/date-utils";
import { getTaskStatuses } from "../utils/bar-metrics";
import type { Granularity } from "../utils/date-utils";
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
  const mouseCursorRef = useRef<HTMLDivElement>(null);
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

  const dateRange = useMemo(() => calculateDateRange(tasks), [tasks]);
  const timelineData = useMemo(
    () => generateTimelineData(dateRange, granularity),
    [dateRange, granularity],
  );
  const currentDatePx = useMemo(
    () => getCurrentDatePosition(timelineData),
    [timelineData],
  );
  const isCurrentDateVisible =
    currentDatePx >= 0 &&
    currentDatePx <= timelineData.totalDays * timelineData.daySize;
  const daySize = getDaySize(granularity);

  const rowHeight = 40;

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const rafRef = useRef<number>(0);

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

  const getTaskStatusMatches = useCallback(
    (task: any): string[] => {
      if (
        statusField &&
        task[statusField] !== undefined &&
        task[statusField] !== null &&
        String(task[statusField]).trim()
      ) {
        return [String(task[statusField]).trim()];
      }
      return getTaskStatuses(task);
    },
    [statusField],
  );

  const taskMatchesFilters = useCallback(
    (task: any): boolean => {
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
    },
    [
      statusFilter,
      statusField,
      extraFieldFilters,
      filter,
      getTaskStatusMatches,
    ],
  );

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

  const matchingChildParentRows = useMemo(
    () =>
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
        : new Set<number>(),
    [hasGroupedRows, hasActiveFilters, tasks, taskMatchesFilters],
  );

  const effectiveCollapsedParents = useMemo(() => {
    const set = new Set<number>(collapsedParents);
    matchingChildParentRows.forEach((row) => {
      set.delete(row);
    });
    return set;
  }, [collapsedParents, matchingChildParentRows]);

  const displayedTasks = useMemo(() => {
    const hasDate = (t: any) => Boolean(t.start);

    if (hasGroupedRows) {
      const result = tasks.filter((task) => {
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
          return hasDate(task) && taskMatchesFilters(task);
        }

        if (taskMatchesFilters(task)) return true;
        return rowNumber >= 0 && matchingChildParentRows.has(rowNumber);
      });
      return result;
    }
    return tasks
      .filter((t) => hasDate(t) && taskMatchesFilters(t))
      .sort(
        (a, b) =>
          (a.start ? parseInt(a.start.replace(/\//g, "")) : 0) -
          (b.start ? parseInt(b.start.replace(/\//g, "")) : 0),
      );
  }, [
    tasks,
    hasGroupedRows,
    effectiveCollapsedParents,
    groupedParentRows,
    matchingChildParentRows,
    taskMatchesFilters,
  ]);

  // Virtualization: only render visible rows to keep DOM small
  const OVERSCAN = 8;
  const virtualStart = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - OVERSCAN,
  );
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + OVERSCAN * 2;
  const virtualEnd = Math.min(
    displayedTasks.length,
    virtualStart + visibleCount,
  );
  const visibleTasks = displayedTasks.slice(virtualStart, virtualEnd);
  const topSpacerHeight = virtualStart * rowHeight;
  const bottomSpacerHeight = (displayedTasks.length - virtualEnd) * rowHeight;

  // Scroll to current date on mount
  useEffect(() => {
    if (isCurrentDateVisible && timelineScrollRef.current) {
      const container = timelineScrollRef.current;
      const targetLeft = currentDatePx - container.clientWidth / 2;
      container.scrollLeft = Math.max(0, targetLeft);
    }
  }, [granularity]);

  const scrollToToday = useCallback(() => {
    if (timelineScrollRef.current && isCurrentDateVisible) {
      const container = timelineScrollRef.current;
      const targetLeft = currentDatePx - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }
  }, [currentDatePx, isCurrentDateVisible]);

  // ResizeObserver to track viewport height for virtualization
  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportHeight(entry.contentRect.height);
    });
    observer.observe(el);
    setViewportHeight(el.clientHeight);
    return () => observer.disconnect();
  }, []);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleScroll = useCallback(() => {
    // Cancel any pending rAF to avoid stacking updates
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const c = timelineScrollRef.current;
      if (!c) return;
      // Vertical scroll for virtualization
      setScrollTop(c.scrollTop);
      // Horizontal: show/hide scroll-to-today button
      if (isCurrentDateVisible) {
        const scrollLeft = c.scrollLeft;
        const visLeft = currentDatePx - timelineData.daySize * 2;
        const visRight = currentDatePx + timelineData.daySize * 2;
        setShowCurrentDateBtn(
          !(scrollLeft <= visLeft && scrollLeft + c.clientWidth >= visRight),
        );
      } else {
        setShowCurrentDateBtn(false);
      }
    });
  }, [currentDatePx, isCurrentDateVisible, timelineData.daySize]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (mouseCursorRef.current) {
      mouseCursorRef.current.style.left = `${x}px`;
      mouseCursorRef.current.style.display = "";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mouseCursorRef.current) {
      mouseCursorRef.current.style.display = "none";
    }
  }, []);

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
        onScroll={handleScroll}
      >
        {/*
          Two-row layout:
          - Header row: sidebar-header (sticky top+left) + timeline-header (sticky top)
          - Body row: sidebar-body (sticky left) + timeline-body (scrolls freely)
          Both rows share the same total width so columns stay aligned.
        */}
        <div
          style={{
            width: `max(100%, ${288 + timelineData.totalDays * daySize}px)`,
          }}
        >
          {/* ── Header row ────────────────────────────────────────── */}
          <div className="sticky top-0 z-50 flex" style={{ height: "64px" }}>
            {/* Sidebar header — sticks to top-left corner */}
            <div className="sticky top-0 left-0 z-50 w-72 shrink-0 h-16 border-b border-border bg-muted flex items-center justify-between px-4">
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
            {/* Timeline header — sticks to top */}
            <div
              className="sticky top-0 z-40 shrink-0 bg-muted"
              style={{ width: `${timelineData.totalDays * daySize}px` }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
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
          </div>

          {/* ── Body row ──────────────────────────────────────────── */}
          <div className="flex" style={{ height: `${displayedTasks.length * rowHeight}px` }}>
            {/* Sidebar body — sticks to left */}
            <div className="sticky left-0 z-30 w-72 shrink-0 border-r border-border bg-background">
              <div style={{ height: `${topSpacerHeight}px` }} />
              {visibleTasks.map((task) => (
                <div
                  key={task.__sheetRow ?? "row"}
                  className="h-10 flex items-center px-4 text-sm hover:bg-muted/30 cursor-pointer border-b border-border"
                  onClick={() => setSelectedTask(task)}
                >
                  {(() => {
                    const rowNumber =
                      typeof task.__sheetRow === "number" ? task.__sheetRow : -1;
                    const isChild = typeof task.__groupParentRow === "number";
                    const hasChildren =
                      rowNumber >= 0 && groupedParentRows.has(rowNumber);
                    const isCollapsed =
                      rowNumber >= 0 && effectiveCollapsedParents.has(rowNumber);

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
                              className={cn(
                                "transition-transform duration-200",
                                isCollapsed ? "rotate-0" : "rotate-180",
                              )}
                            />
                          </button>
                        ) : (
                          <span className="mr-1 inline-block h-5 w-5 shrink-0" />
                        )}
                        <span className={cn("truncate", isChild && "ml-3")}>
                          {task.name}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ))}
              <div style={{ height: `${bottomSpacerHeight}px` }} />
              {displayedTasks.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground italic">
                  Nenhuma tarefa encontrada
                </div>
              )}
            </div>

            {/* Timeline body — scrolls freely in both directions */}
            <div
              className="relative shrink-0"
              style={{
                width: `${timelineData.totalDays * daySize}px`,
              }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <div style={{ height: `${topSpacerHeight}px` }} />
              {visibleTasks.map((task) => (
                <div
                  key={task.__sheetRow ?? "row"}
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
              <div style={{ height: `${bottomSpacerHeight}px` }} />

              {isCurrentDateVisible && (
                <div
                  className="absolute z-0 w-0.5 bg-timeline-today pointer-events-none"
                  style={{
                    left: `${currentDatePx}px`,
                    top: `${topSpacerHeight}px`,
                    height: `${Math.max(displayedTasks.length * rowHeight, 24)}px`,
                  }}
                />
              )}

              <div
                ref={mouseCursorRef}
                className="absolute z-0 w-px bg-secondary pointer-events-none"
                style={{
                  display: "none",
                  top: `${topSpacerHeight}px`,
                  height: `${Math.max(displayedTasks.length * rowHeight, 24)}px`,
                }}
              />
            </div>
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
