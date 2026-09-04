import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/vercel-auth", () => ({
  getAccessToken: vi.fn(async () => "test-token"),
}));

const jsonResponse = (body: unknown) =>
  ({
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }) as Response;

describe("Vercel Sheets API fetching", () => {
  beforeEach(() => {
    vi.resetModules();
    (globalThis as any).window = { __TIMELINE_VERCEL__: true };
    (globalThis as any).fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          spreadsheetId: "spreadsheet-1",
          properties: { title: "Roadmap" },
          sheets: [{ properties: { title: "Tasks" } }],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          values: [
            ["Name", "Start", "End", "Due"],
            ["Design", 46266, "", 46270],
          ],
        }),
      );
  });

  it("requests unformatted values so Sheets returns date serial numbers", async () => {
    const { fetchSheetRows } = await import("../utils/sheet-host");

    await fetchSheetRows("spreadsheet-1", "Tasks");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const valuesUrl = new URL(String(fetchMock.mock.calls[1][0]));

    expect(valuesUrl.searchParams.get("valueRenderOption")).toBe(
      "UNFORMATTED_VALUE",
    );
    expect(valuesUrl.searchParams.get("dateTimeRenderOption")).toBe(
      "SERIAL_NUMBER",
    );
  });
});
