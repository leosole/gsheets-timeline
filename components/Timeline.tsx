import React, { useState, useRef, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import { Controls } from "./Controls";
import { Legend } from "./Legend";
import { TaskBar } from "./TaskBar";
import { TaskPopover } from "./TaskPopover";
import {
  calculateDateRange,
  generateTimelineData,
  getCurrentDatePosition,
  getDaySize,
} from "../utils/dateUtils";
import { getTaskStatuses } from "../utils/barMetrics";
import type { Granularity, TimelineData } from "../utils/dateUtils";

interface TimelineProps {
  tasks: any[];
  title?: string;
  filterFields?: string[];
  popupFields?: string[];
  sheetUrl?: string | null;
  statusField?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  tasks,
  title = "Timeline",
  filterFields = [],
  popupFields = [],
  sheetUrl,
  statusField,
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

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const barsContainerRef = useRef<HTMLDivElement>(null);

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

  // Scroll sync
  const handleBarsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (barsContainerRef.current) {
      const sidebar =
        barsContainerRef.current.parentElement?.querySelector(".task-sidebar");
      if (sidebar) sidebar.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (barsContainerRef.current) {
      barsContainerRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Scroll to current date on mount
  useEffect(() => {
    if (isCurrentDateVisible && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetLeft = currentDatePx - container.clientWidth / 2;
      container.scrollLeft = Math.max(0, targetLeft);
    }
  }, [granularity]);

  const scrollToToday = () => {
    if (scrollContainerRef.current && isCurrentDateVisible) {
      const container = scrollContainerRef.current;
      const targetLeft = currentDatePx - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current && isCurrentDateVisible) {
      const c = scrollContainerRef.current;
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex-shrink-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
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
            Gerado: {new Date().toLocaleString("pt-BR")}
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

      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="h-16 border-b border-border bg-muted/50 flex-shrink-0 flex items-center px-4">
            <span className="font-semibold text-sm text-foreground">
              Tarefas
            </span>
          </div>
          <div
            className="flex-1 min-h-0 overflow-y-auto divide-y divide-border task-sidebar"
            onScroll={handleSidebarScroll}
          >
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

        {/* Timeline area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <div
              ref={barsContainerRef}
              className="h-full overflow-y-auto overflow-x-auto"
              onScroll={handleBarsScroll}
            >
              <div
                className="relative"
                style={{
                  width: `${timelineData.totalDays * daySize}px`,
                  minWidth: "100%",
                }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMouseDatePx(e.clientX - rect.left);
                }}
                onMouseLeave={() => setMouseDatePx(undefined)}
              >
                <Header
                  timelineData={timelineData}
                  granularity={granularity}
                  daySize={daySize}
                  currentDatePx={currentDatePx}
                />

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

                {/* Today line */}
                {isCurrentDateVisible && (
                  <div
                    className="absolute w-0.5 bg-timeline-today z-20 pointer-events-none"
                    style={{
                      left: `${currentDatePx}px`,
                      top: "64px",
                      height: `${Math.max(displayedTasks.length * rowHeight, 24)}px`,
                    }}
                  />
                )}

                {/* Mouse date line */}
                {mouseDatePx !== undefined && (
                  <div
                    className="absolute w-px bg-secondary z-20 pointer-events-none"
                    style={{
                      left: `${mouseDatePx}px`,
                      top: "64px",
                      height: `${Math.max(displayedTasks.length * rowHeight, 24)}px`,
                    }}
                  />
                )}

                {/* Today circle marker */}
                {isCurrentDateVisible &&
                  (granularity === "week" || granularity === "month") && (
                    <div
                      className="absolute w-5 h-5 bg-timeline-today rounded-full z-30 pointer-events-none text-xs flex items-center justify-center text-white font-bold"
                      style={{ left: `${currentDatePx - 10}px`, top: "50px" }}
                    >
                      {dayjs().date()}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0">
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

interface HeaderProps {
  timelineData: TimelineData;
  granularity: Granularity;
  daySize: number;
  currentDatePx: number;
}

const Header: React.FC<HeaderProps> = ({
  timelineData,
  granularity,
  daySize,
  currentDatePx,
}) => {
  const days = timelineData.days.map((d) => ({
    ...d,
    displayLabel:
      granularity === "day"
        ? dayjs(d.date).date().toString()
        : granularity === "week"
          ? dayjs(d.date).format("dd")
          : dayjs(d.date).date().toString(),
  }));

  // Build month spans
  const months: { label: string; span: number }[] = [];
  let currentMonth = "";
  let currentSpan = 0;
  days.forEach((day, i) => {
    const mLabel = dayjs(day.date).format("MMMM YYYY");
    if (mLabel !== currentMonth) {
      if (currentMonth) months.push({ label: currentMonth, span: currentSpan });
      currentMonth = mLabel;
      currentSpan = 1;
    } else {
      currentSpan++;
    }
    if (i === days.length - 1)
      months.push({ label: currentMonth, span: currentSpan });
  });

  // Build week spans for week granularity
  const weeks: { label: string; span: number }[] = [];
  if (granularity === "week") {
    let weekStart: dayjs.Dayjs | null = null;
    let weekDays = 0;
    days.forEach((day, i) => {
      const d = dayjs(day.date);
      if (d.day() === 1 || weekStart === null) {
        if (weekStart && weekDays > 0) {
          const wEnd = weekStart.add(weekDays - 1, "day");
          const fmt = wEnd.month() === weekStart.month() ? "D" : "D/M";
          weeks.push({
            label: `${weekStart.format(fmt)} a ${wEnd.format(fmt)}`,
            span: weekDays,
          });
        }
        weekStart = d;
        weekDays = 1;
      } else {
        weekDays++;
      }
      if (i === days.length - 1 && weekStart) {
        const wEnd = weekStart.add(weekDays - 1, "day");
        const fmt = wEnd.month() === weekStart.month() ? "D" : "D/M";
        weeks.push({
          label: `${weekStart.format(fmt)} a ${wEnd.format(fmt)}`,
          span: weekDays,
        });
      }
    });
  }

  const todayStr = dayjs().format("YYYY-MM-DD");

  return (
    <div className="border-b border-border bg-muted/50 h-16 relative">
      <div className="flex flex-col justify-center h-full">
        {granularity === "month" ? (
          <div className="flex h-full items-end pb-1">
            {months.map((m, i) => (
              <div
                key={i}
                className="text-xs font-medium text-muted-foreground text-center border-r border-border last:border-r-0 leading-3 h-full flex items-end pb-1"
                style={{ width: `${m.span * daySize}px` }}
              >
                {m.label.split(" ")[0]}
              </div>
            ))}
          </div>
        ) : granularity === "week" ? (
          <>
            <div className="flex h-1/2 items-end pb-1">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="text-xs font-medium text-muted-foreground text-center border-r border-border last:border-r-0 leading-3"
                  style={{ width: `${m.span * daySize}px` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="flex h-1/2 items-start pt-1 border-t border-border">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="text-xs font-medium text-muted-foreground text-center border-r border-border last:border-r-0 leading-3"
                  style={{ width: `${w.span * daySize}px` }}
                >
                  {w.label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex h-1/2 items-end pb-1">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="text-xs font-medium text-muted-foreground text-center border-r border-border last:border-r-0 leading-3"
                  style={{ width: `${m.span * daySize}px` }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="flex h-1/2 items-start pt-1 border-t border-border">
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`text-xs text-center border-r border-border last:border-r-0 leading-3 ${
                    day.date === todayStr
                      ? "text-timeline-today font-bold bg-timeline-today/10"
                      : "text-muted-foreground"
                  }`}
                  style={{ width: `${daySize}px` }}
                >
                  {day.displayLabel}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
