"use client";

import { useEffect, useState } from "react";
import { Repeat, X } from "lucide-react";
import type { Invoice, RecurringFrequency, RecurringSchedule } from "@/lib/types";
import { FREQUENCIES, defaultStartDate, nextRunDate } from "@/lib/recurring";
import { createId, removeSchedule, todayISO, upsertSchedule } from "@/lib/storage";

// Create, edit or stop the recurring schedule for one source invoice.
export function RecurringModal({
  source,
  existing,
  onClose,
  onChange,
}: {
  source: Invoice;
  existing?: RecurringSchedule;
  onClose: () => void;
  onChange: (schedule: RecurringSchedule | undefined) => void;
}) {
  const today = todayISO();
  const [frequency, setFrequency] = useState<RecurringFrequency>(existing?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(
    existing ? (nextRunDate(existing) ?? today) : defaultStartDate(source, "monthly", today)
  );
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function changeFrequency(f: RecurringFrequency) {
    setFrequency(f);
    if (!existing) setStartDate(defaultStartDate(source, f, today));
  }

  function save() {
    if (!startDate) return setError("Pick the date of the next invoice.");
    if (endDate && endDate < startDate) return setError("The end date is before the next invoice.");
    // Editing re-anchors the schedule at the chosen next date, so the
    // occurrence count restarts from there.
    const schedule: RecurringSchedule = {
      id: existing?.id ?? createId(),
      sourceInvoiceId: source.id,
      frequency,
      startDate,
      ...(endDate ? { endDate } : {}),
      runCount: 0,
      active: true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      ...(existing?.lastRunDate ? { lastRunDate: existing.lastRunDate } : {}),
    };
    upsertSchedule(schedule);
    onChange(schedule);
    onClose();
  }

  function stop() {
    if (!existing) return;
    if (!confirm("Stop repeating this invoice? Invoices already created are kept.")) return;
    removeSchedule(existing.id);
    onChange(undefined);
    onClose();
  }

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-title"
    >
      <div
        className="my-16 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h3 id="recurring-title" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Repeat className="h-4 w-4 text-brand-600" /> Repeat {source.number}
          </h3>
          <button className="btn-ghost -mr-2" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-xs text-ink-500">
            A new draft copy of this invoice is created on each date. Copies use this invoice&apos;s
            current details, so edit it to change future copies. Copies are made when you next
            open AnnexInvoice on or after the date.
          </p>
          <label className="block text-xs font-medium text-ink-600">
            Repeat
            <select
              className="field mt-1"
              value={frequency}
              onChange={(e) => changeFrequency(e.target.value as RecurringFrequency)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-ink-600">
            Next invoice on
            <input type="date" className="field mt-1" value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-ink-600">
            End after (optional)
            <input type="date" className="field mt-1" value={endDate}
              onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {error && <p className="text-xs font-medium text-rose-600" role="alert">{error}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-ink-100 p-4">
          {existing ? (
            <button className="btn-ghost text-rose-600" onClick={stop}>Stop repeating</button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save}>
              {existing ? "Save schedule" : "Start repeating"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
