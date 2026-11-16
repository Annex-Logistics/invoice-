import { test, expect } from "@playwright/test";
import {
  MAX_CATCH_UP,
  addMonthsClamped,
  buildRunInvoice,
  defaultStartDate,
  dueRuns,
  nextRunDate,
  occurrence,
} from "../../lib/recurring";
import { parseBackup } from "../../lib/import";
import type { RecurringSchedule } from "../../lib/types";
import { makeInvoice } from "./fixtures";

const schedule = (over: Partial<RecurringSchedule> = {}): RecurringSchedule => ({
  id: "s1",
  sourceInvoiceId: "inv-1",
  frequency: "monthly",
  startDate: "2026-01-31",
  runCount: 0,
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

test("month-end dates clamp without drifting", () => {
  expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  expect(occurrence("2026-01-31", "monthly", 2)).toBe("2026-03-31");
  expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29"); // leap year
  expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
});

test("weekly, quarterly and yearly occurrences", () => {
  expect(occurrence("2026-12-28", "weekly", 1)).toBe("2027-01-04");
  expect(occurrence("2026-11-30", "quarterly", 1)).toBe("2027-02-28");
  expect(occurrence("2028-02-29", "yearly", 1)).toBe("2029-02-28");
});

test("dueRuns catches up missed dates up to today, oldest first", () => {
  expect(dueRuns(schedule(), "2026-04-10")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  expect(dueRuns(schedule({ runCount: 2 }), "2026-04-10")).toEqual(["2026-03-31"]);
  expect(dueRuns(schedule({ active: false }), "2026-04-10")).toEqual([]);
});

test("dueRuns respects the end date and the catch-up cap", () => {
  expect(dueRuns(schedule({ endDate: "2026-02-28" }), "2026-12-01")).toEqual([
    "2026-01-31",
    "2026-02-28",
  ]);
  expect(dueRuns(schedule({ frequency: "weekly", startDate: "2020-01-01" }), "2026-01-01")).toHaveLength(
    MAX_CATCH_UP
  );
});

test("nextRunDate is null once past the end date", () => {
  expect(nextRunDate(schedule({ runCount: 2, endDate: "2026-02-28" }))).toBeNull();
  expect(nextRunDate(schedule({ runCount: 1 }))).toBe("2026-02-28");
});

test("default first run is one period after the source, never in the past", () => {
  const src = makeInvoice({ issueDate: "2026-11-01" });
  expect(defaultStartDate(src, "monthly", "2026-11-15")).toBe("2026-12-01");
  expect(defaultStartDate(src, "weekly", "2026-11-15")).toBe("2026-11-15");
});

test("a run copies the source as a fresh draft with the same payment terms", () => {
  const src = makeInvoice({
    status: "paid",
    issueDate: "2026-01-01",
    dueDate: "2026-01-15",
    clientId: "c1",
    payments: [{ id: "p", date: "2026-01-02", amount: 200, method: "cash", note: "" }],
  });
  let n = 0;
  const inv = buildRunInvoice(src, schedule(), "2026-02-28", {
    id: "new",
    number: "INV-0042",
    now: "2026-02-28T09:00:00.000Z",
    newLineId: () => `line-${++n}`,
  });
  expect(inv).toMatchObject({
    id: "new",
    number: "INV-0042",
    status: "draft",
    issueDate: "2026-02-28",
    dueDate: "2026-03-14",
    payments: [],
    amountPaid: 0,
    recurringId: "s1",
    clientId: "c1",
  });
  expect(inv.items[0].id).toBe("line-1");
  expect(src.items[0].id).toBe("l1"); // source untouched
});

test("schedules and recurringId survive a backup round-trip", () => {
  const result = parseBackup(
    JSON.stringify({
      recurring: [schedule({ endDate: "2026-12-31" }), { id: "bad" }],
      invoices: [makeInvoice({ recurringId: "s1" })],
    })
  );
  expect(result.recurring).toEqual([schedule({ endDate: "2026-12-31" })]);
  expect(result.invoices?.[0].recurringId).toBe("s1");
  expect(result.warnings).toContain("Skipped 1 invalid recurring schedule(s).");
});
