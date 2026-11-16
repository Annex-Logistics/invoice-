import type { Invoice, RecurringFrequency, RecurringSchedule } from "./types";

// Pure scheduling logic for recurring invoices. There is no backend, so
// schedules run lazily: whenever the app opens, every occurrence that
// has come due since the last visit is generated (see runDueSchedules in
// lib/storage.ts). Dates are local-calendar ISO strings.

export const FREQUENCIES: Array<{ value: RecurringFrequency; label: string }> = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Yearly" },
];

// Safety cap: a schedule left alone for years catches up at most this
// many invoices per app load, so one visit can't flood storage.
export const MAX_CATCH_UP = 24;

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
}

function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // m is 1-based here
}

export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const index = y * 12 + (m - 1) + months;
  const ty = Math.floor(index / 12);
  const tm = (index % 12) + 1;
  return fmt(ty, tm, Math.min(d, daysInMonth(ty, tm)));
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  const dt = new Date(y, m - 1, d + days);
  return fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// Date of occurrence n (0-based), always computed from the anchor.
export function occurrence(start: string, frequency: RecurringFrequency, n: number): string {
  switch (frequency) {
    case "weekly":
      return addDays(start, 7 * n);
    case "monthly":
      return addMonthsClamped(start, n);
    case "quarterly":
      return addMonthsClamped(start, 3 * n);
    case "yearly":
      return addMonthsClamped(start, 12 * n);
  }
}

export function nextRunDate(s: RecurringSchedule): string | null {
  const next = occurrence(s.startDate, s.frequency, s.runCount);
  if (s.endDate && next > s.endDate) return null;
  return next;
}

// Default first run for a new schedule: one period after the source
// invoice's issue date (the source itself is the first bill).
export function defaultStartDate(source: Invoice, frequency: RecurringFrequency, today: string): string {
  const base = source.issueDate || today;
  const first = occurrence(base, frequency, 1);
  return first < today ? today : first;
}

// Occurrence dates that are due (on or before today), oldest first,
// capped at MAX_CATCH_UP.
export function dueRuns(s: RecurringSchedule, today: string): string[] {
  if (!s.active) return [];
  const runs: string[] = [];
  for (let n = s.runCount; runs.length < MAX_CATCH_UP; n++) {
    const date = occurrence(s.startDate, s.frequency, n);
    if (date > today) break;
    if (s.endDate && date > s.endDate) break;
    runs.push(date);
  }
  return runs;
}

// Build the invoice for one run from the source's current content.
export function buildRunInvoice(
  source: Invoice,
  schedule: RecurringSchedule,
  runDate: string,
  ids: { id: string; number: string; now: string; newLineId: () => string }
): Invoice {
  const terms =
    source.issueDate && source.dueDate ? Math.max(0, daysBetween(source.issueDate, source.dueDate)) : 0;
  return {
    ...source,
    id: ids.id,
    kind: "invoice",
    number: ids.number,
    status: "draft",
    createdAt: ids.now,
    updatedAt: ids.now,
    issueDate: runDate,
    dueDate: addDays(runDate, terms),
    amountPaid: 0,
    payments: [],
    recurringId: schedule.id,
    items: source.items.map((item) => ({ ...item, id: ids.newLineId() })),
  };
}

export function frequencyLabel(f: RecurringFrequency): string {
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}
