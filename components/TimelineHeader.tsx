import React from "react";
import dayjs from "dayjs";
import type { Granularity, TimelineData } from "../utils/dateUtils";

interface TimelineHeaderProps {
  timelineData: TimelineData;
  granularity: Granularity;
  daySize: number;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  timelineData,
  granularity,
  daySize,
}) => {
  const days = timelineData.days.map((day) => ({
    ...day,
    displayLabel:
      granularity === "day"
        ? dayjs(day.date).date().toString()
        : granularity === "week"
          ? dayjs(day.date).format("dd")
          : dayjs(day.date).date().toString(),
  }));

  const months: { label: string; span: number }[] = [];
  let currentMonth = "";
  let currentSpan = 0;
  days.forEach((day, index) => {
    const monthLabel = dayjs(day.date).format("MMMM YYYY");
    if (monthLabel !== currentMonth) {
      if (currentMonth) months.push({ label: currentMonth, span: currentSpan });
      currentMonth = monthLabel;
      currentSpan = 1;
    } else {
      currentSpan++;
    }
    if (index === days.length - 1) {
      months.push({ label: currentMonth, span: currentSpan });
    }
  });

  const weeks: { label: string; span: number }[] = [];
  if (granularity === "week") {
    let weekStart: dayjs.Dayjs | null = null;
    let weekDays = 0;
    days.forEach((day, index) => {
      const currentDay = dayjs(day.date);
      if (currentDay.day() === 1 || weekStart === null) {
        if (weekStart && weekDays > 0) {
          weeks.push(formatWeek(weekStart, weekDays));
        }
        weekStart = currentDay;
        weekDays = 1;
      } else {
        weekDays++;
      }
      if (index === days.length - 1 && weekStart) {
        weeks.push(formatWeek(weekStart, weekDays));
      }
    });
  }

  const todayStr = dayjs().format("YYYY-MM-DD");

  return (
    <div className="relative h-16 border-b border-border bg-muted/50">
      <div className="flex h-full flex-col justify-center">
        {granularity === "month" ? (
          <div className="flex h-full items-end pb-1">
            {months.map((month, index) => (
              <div
                key={index}
                className="flex h-full items-end border-r border-border pb-1 text-center text-xs font-medium leading-3 text-muted-foreground last:border-r-0"
                style={{ width: `${month.span * daySize}px` }}
              >
                {month.label.split(" ")[0]}
              </div>
            ))}
          </div>
        ) : granularity === "week" ? (
          <>
            <div className="flex h-1/2 items-end pb-1">
              {months.map((month, index) => (
                <div
                  key={index}
                  className="text-center text-xs font-medium leading-3 text-muted-foreground"
                  style={{ width: `${month.span * daySize}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            <div className="flex h-1/2 items-start border-t border-border pt-1">
              {weeks.map((week, index) => (
                <div
                  key={index}
                  className="text-center text-xs font-medium leading-3 text-muted-foreground"
                  style={{ width: `${week.span * daySize}px` }}
                >
                  {week.label}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex h-1/2 items-end pb-1">
              {months.map((month, index) => (
                <div
                  key={index}
                  className="text-center text-xs font-medium leading-3 text-muted-foreground"
                  style={{ width: `${month.span * daySize}px` }}
                >
                  {month.label}
                </div>
              ))}
            </div>
            <div className="flex h-1/2 items-start border-t border-border pt-1">
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`border-r border-border text-center text-xs leading-3 last:border-r-0 ${
                    day.date === todayStr
                      ? "bg-timeline-today/10 font-bold text-timeline-today"
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

const formatWeek = (weekStart: dayjs.Dayjs, weekDays: number) => {
  const weekEnd = weekStart.add(weekDays - 1, "day");
  const format = weekEnd.month() === weekStart.month() ? "D" : "D/M";
  return {
    label: `${weekStart.format(format)} a ${weekEnd.format(format)}`,
    span: weekDays,
  };
};
