"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pause, Play, Repeat, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Invoice, RecurringSchedule } from "@/lib/types";
import { loadInvoices, loadSchedules, removeSchedule, todayISO, upsertSchedule } from "@/lib/storage";
import { frequencyLabel, nextRunDate, occurrence } from "@/lib/recurring";
import { calcTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/currencies";

function statusOf(s: RecurringSchedule): { label: string; tone: string } {
  if (s.problem === "source-missing") return { label: "Source deleted", tone: "bg-rose-50 text-rose-700" };
  if (s.active) return { label: "Active", tone: "bg-emerald-50 text-emerald-700" };
  if (nextRunDate(s) === null) return { label: "Finished", tone: "bg-ink-100 text-ink-600" };
  return { label: "Paused", tone: "bg-amber-50 text-amber-700" };
}

export default function RecurringPage() {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    setSchedules(loadSchedules());
    setInvoices(loadInvoices());
  }, []);

  const generatedCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.recurringId) m.set(inv.recurringId, (m.get(inv.recurringId) ?? 0) + 1);
    }
    return m;
  }, [invoices]);

  function save(next: RecurringSchedule) {
    upsertSchedule(next);
    setSchedules(loadSchedules());
  }

  function togglePause(s: RecurringSchedule) {
    if (s.active) return save({ ...s, active: false });
    // Resuming skips the dates missed while paused instead of creating
    // a pile of back-dated invoices.
    const today = todayISO();
    let runCount = s.runCount;
    while (occurrence(s.startDate, s.frequency, runCount) < today) runCount++;
    save({ ...s, active: true, runCount });
  }

  function remove(s: RecurringSchedule) {
    if (!confirm("Delete this schedule? Invoices it already created are kept.")) return;
    removeSchedule(s.id);
    setSchedules(loadSchedules());
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900">Recurring</h1>
          <p className="text-sm text-ink-500">
            Invoices that repeat on a schedule. Open an invoice and choose <strong>Repeat</strong> to
            add one. New copies are created as drafts when you open AnnexInvoice on or after each date.
          </p>
        </div>

        {schedules.length === 0 ? (
          <div className="card flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Repeat className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-ink-900">No recurring invoices</h3>
            <p className="mt-1 max-w-sm text-xs text-ink-500">
              Retainers, rent, monthly deliveries: open the invoice and click Repeat.
            </p>
            <Link href="/invoices" className="btn-primary mt-4">Go to invoices</Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/70 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Repeats</th>
                  <th className="px-4 py-3">Next</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => {
                  const source = invoices.find((i) => i.id === s.sourceInvoiceId);
                  const status = statusOf(s);
                  const next = s.active ? nextRunDate(s) : null;
                  return (
                    <tr key={s.id} className="border-t border-ink-100">
                      <td className="px-4 py-3">
                        {source ? (
                          <>
                            <Link href={`/invoices/${source.id}`} className="font-semibold text-brand-700 hover:text-brand-800">
                              {source.number}
                            </Link>
                            <div className="text-xs text-ink-500">
                              {source.billTo.name || "No client"} ·{" "}
                              {formatMoney(calcTotals(source).total, source.currency)}
                            </div>
                          </>
                        ) : (
                          <span className="text-ink-400">Deleted invoice</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-700">
                        {frequencyLabel(s.frequency)}
                        {s.endDate && <div className="text-xs text-ink-500">until {s.endDate}</div>}
                      </td>
                      <td className="px-4 py-3 text-ink-700">{next ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-700">{generatedCount.get(s.id) ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {!s.problem && (s.active || nextRunDate(s) !== null) && (
                            <button
                              className="btn-ghost !px-2"
                              onClick={() => togglePause(s)}
                              aria-label={s.active ? "Pause" : "Resume"}
                              title={s.active ? "Pause" : "Resume"}
                            >
                              {s.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                          )}
                          <button
                            className="btn-ghost !px-2 text-ink-400 hover:text-rose-600"
                            onClick={() => remove(s)}
                            aria-label="Delete schedule"
                            title="Delete schedule"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
