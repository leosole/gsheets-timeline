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
import { PiCalendarDotBold } from "react-icons/pi";

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

  const displayedTasks = tasks
    .filter((t) => {
      if (
        statusFilter.length > 0 &&
        !statusFilter.some((s) => getTaskStatusMatches(t).includes(s))
      )
        return false;
      for (const [field, val] of Object.entries(extraFieldFilters)) {
        if (String(t[field] ?? "") !== val) return false;
      }
      return t.name.toLowerCase().includes(filter.toLowerCase());
    })
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
            <div className="sticky top-0 z-30 h-16 border-b border-border bg-muted shrink-0 flex items-center px-4">
              <span className="font-semibold text-sm text-foreground">
                Tarefas
              </span>
            </div>
            <div className="divide-y divide-border">
              {displayedTasks.map((task, idx) => (
                <div
                  key={idx}
                  className="h-10 flex items-center px-4 text-sm hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedTask(task)}
                >
                  <span className="truncate">{task.name}</span>
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
                key={idx}
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
