import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { calculateBarMetrics } from "../utils/bar-metrics";
import { generateTimelineData } from "../utils/date-utils";
import {
  DEFAULT_FIELD_MAP,
  buildFieldOptions,
  sanitizeSpreadsheetData,
} from "../utils/sheet-config";

describe("buildFieldOptions", () => {
  it("includes sheet headers even when there are no data rows", () => {
    expect(buildFieldOptions([], ["Name", "Start", "Due"])).toEqual([
      "Due",
      "Name",
      "Start",
    ]);
    expect(
      buildFieldOptions(
        [{ Name: "Task 1", Start: "2026-01-01" }],
        ["Name", "Start", "Due"],
      ),
    ).toEqual(["Due", "Name", "Start"]);
  });

  it("ignores internal metadata keys used by timeline grouping", () => {
    expect(
      buildFieldOptions(
        [
          {
            Name: "Task 1",
            Start: "2026-01-01",
            __sheetRow: 2,
            __groupParentRow: 1,
          },
        ],
        ["Name", "Start"],
      ),
    ).toEqual(["Name", "Start"]);
  });
});

describe("sanitizeSpreadsheetData", () => {
  it("maps spreadsheet rows into timeline task objects", () => {
    const rows = [
      {
        Name: "Design review",
        Start: "01/09/2026",
        End: "05/09/2026",
        Due: "04/09/2026",
        Owner: "Ana",
        Status: "In progress",
      },
      {
        Name: "",
        Start: "02/09/2026",
        End: "",
        Due: "",
      },
    ];

    const tasks = sanitizeSpreadsheetData(rows, DEFAULT_FIELD_MAP);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      name: "Design review",
      start: "01/09/2026",
      end: "05/09/2026",
      due: "04/09/2026",
      Owner: "Ana",
      Status: "In progress",
    });
  });

  it("keeps extra metadata fields in the task object", () => {
    const tasks = sanitizeSpreadsheetData(
      [
        {
          Name: "Task 1",
          Start: "10/09/2026",
          End: "",
          Due: "",
          Notes: "Follow up",
        },
      ],
      DEFAULT_FIELD_MAP,
    );

    expect(tasks[0].Notes).toBe("Follow up");
  });

  it("keeps internal grouping metadata in sanitized tasks", () => {
    const tasks = sanitizeSpreadsheetData(
      [
        {
          Name: "Group parent",
          Start: "10/09/2026",
          End: "",
          Due: "",
          __sheetRow: 4,
          __isGroupParent: true,
          __groupCollapsed: true,
          __groupChildCount: 3,
        },
      ],
      DEFAULT_FIELD_MAP,
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      __sheetRow: 4,
      __isGroupParent: true,
      __groupCollapsed: true,
      __groupChildCount: 3,
    });
  });

  it("prefers the configured name column over any raw name field in the row", () => {
    const tasks = sanitizeSpreadsheetData(
      [
        {
          name: "Wrong first-column value",
          "Task Name": "Correct task name",
          Start: "10/09/2026",
          End: "12/09/2026",
          Due: "11/09/2026",
        },
      ],
      {
        name: "Task Name",
        start: "Start",
        end: "End",
        due: "Due",
      },
    );

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe("Correct task name");
  });
});

describe("status color fallback", () => {
  const getTaskDates = () => {
    const now = dayjs();
    const start = now.subtract(3, "day").format("DD/MM/YYYY");
    const due = now.add(4, "day").format("DD/MM/YYYY");
    return { start, due };
  };

  it("keeps the legacy default status colors when no status column is selected", () => {
    const { start, due } = getTaskDates();
    const rangeStart = dayjs(start, "DD/MM/YYYY").subtract(7, "day");
    const rangeEnd = dayjs(due, "DD/MM/YYYY").add(7, "day");
    const timelineData = generateTimelineData(
      { start: rangeStart, end: rangeEnd },
      "week",
    );

    const task = {
      name: "Task 1",
      start,
      end: "",
      due,
    };

    const metrics = calculateBarMetrics(task, timelineData, "week");

    expect(metrics?.status).toBe("Fazendo");
    expect(metrics?.colors.bg).toBe("bg-yellow-200 dark:bg-yellow-600");
    expect(metrics?.customColors).toBeUndefined();
  });

  it("uses custom colors for explicit status values when a status column is selected", () => {
    const { start, due } = getTaskDates();
    const rangeStart = dayjs(start, "DD/MM/YYYY").subtract(7, "day");
    const rangeEnd = dayjs(due, "DD/MM/YYYY").add(7, "day");
    const timelineData = generateTimelineData(
      { start: rangeStart, end: rangeEnd },
      "week",
    );

    const task = {
      name: "Task 1",
      start,
      end: "",
      due,
      Status: "Fazendo",
    };

    const metrics = calculateBarMetrics(task, timelineData, "week", "Status", {
      Fazendo: "#123456",
    });

    expect(metrics?.status).toBe("Fazendo");
    expect(metrics?.customColors?.bg).toBe("#123456");
    expect(metrics?.customColors?.darkBorder).toContain("#123456");
    expect(metrics?.customColors?.lightBorder).toContain("#123456");
  });
});
