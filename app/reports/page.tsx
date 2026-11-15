"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, FileText, TrendingUp, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Client, Invoice } from "@/lib/types";
import { loadClients, loadInvoices, todayISO } from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { formatMoney, DEFAULT_CURRENCY } from "@/lib/currencies";
import { matchClient } from "@/lib/clients";
import {
  RANGE_PRESETS,
  buildBuckets,
  currenciesByUse,
  filterDocs,
  resolveRange,
  summarize,
  type RangePreset,
} from "@/lib/reports";

export default function ReportsPage() {
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [preset, setPreset] = useState<RangePreset>("12m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");

  useEffect(() => {
    setAllInvoices(loadInvoices());
    setClients(loadClients());
  }, []);

  const today = todayISO();
  const currencies = useMemo(() => currenciesByUse(allInvoices), [allInvoices]);
  // Never sum different currencies: report one at a time, defaulting to
  // the most-used one.
  const displayCurrency =
    currencies.find((c) => c.code === currencyCode) ?? currencies[0] ?? DEFAULT_CURRENCY;
  const range = useMemo(
    () => resolveRange(preset, today, { from: customFrom, to: customTo }),
    [preset, today, customFrom, customTo]
  );
  const invoices = useMemo(
    () => filterDocs(allInvoices, range, displayCurrency.code),
    [allInvoices, range, displayCurrency.code]
  );

  const stats = useMemo(() => summarize(invoices, today), [invoices, today]);
  const buckets = useMemo(() => buildBuckets(invoices, range, today), [invoices, range, today]);
  const maxBucket = Math.max(1, ...buckets.map((m) => Math.max(m.invoiced, m.collected)));
  const rangeLabel =
    preset === "custom"
      ? `${range.from || "start"} to ${range.to || "today"}`
      : RANGE_PRESETS.find((r) => r.value === preset)!.label.toLowerCase();

  const outstandingByClient = useMemo(() => {
    const map = new Map<
      string,
      { name: string; email: string; outstanding: number; invoiceCount: number }
    >();
    for (const inv of invoices) {
      if (inv.status === "paid") continue;
      const t = calcTotals(inv);
      if (t.balanceDue <= 0) continue;
      // Group by saved client when we can attribute one (survives
      // renames); otherwise by the bill-to email/name on the invoice.
      const client = matchClient(inv, clients);
      const key = client
        ? `client:${client.id}`
        : (inv.billTo.email || inv.billTo.name || "—").toLowerCase().trim();
      const existing = map.get(key);
      if (existing) {
        existing.outstanding += t.balanceDue;
        existing.invoiceCount++;
      } else {
        map.set(key, {
          name: client?.name || inv.billTo.name || inv.billTo.email || "Unknown",
          email: client?.email || inv.billTo.email,
          outstanding: t.balanceDue,
          invoiceCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  }, [invoices, clients]);

  const taxByLabel = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status !== "paid") continue;
      const t = calcTotals(inv);
      if (t.tax <= 0) continue;
      const label = `${inv.taxLabel}${inv.taxMode === "percent" ? ` (${inv.taxValue}%)` : ""}`;
      map.set(label, (map.get(label) ?? 0) + t.tax);
    }
    return Array.from(map.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ink-900">Reports</h1>
          <p className="text-sm text-ink-500">
            Billing, outstanding balances by client, and tax collected, for invoices issued in the
            selected period.
          </p>
        </div>

        {allInvoices.length > 0 && (
          <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
            <label className="text-xs font-medium text-ink-600">
              Period
              <select
                className="field mt-1"
                value={preset}
                onChange={(e) => setPreset(e.target.value as RangePreset)}
              >
                {RANGE_PRESETS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            {preset === "custom" && (
              <>
                <label className="text-xs font-medium text-ink-600">
                  From
                  <input type="date" className="field mt-1" value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)} />
                </label>
                <label className="text-xs font-medium text-ink-600">
                  To
                  <input type="date" className="field mt-1" value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)} />
                </label>
              </>
            )}
            {currencies.length > 1 && (
              <label className="text-xs font-medium text-ink-600">
                Currency
                <select
                  className="field mt-1"
                  value={displayCurrency.code}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                  ))}
                </select>
              </label>
            )}
            <div className="ml-auto text-xs text-ink-500">
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"} in {displayCurrency.code}
            </div>
          </div>
        )}

        {allInvoices.length === 0 ? (
          <div className="card flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <BarChart3 className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-ink-900">No data yet</h3>
            <p className="mt-1 max-w-sm text-xs text-ink-500">
              Reports appear here once you have at least one invoice.
            </p>
            <Link href="/invoices/new" className="btn-primary mt-4">Create invoice</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total invoiced"      value={formatMoney(stats.invoiced, displayCurrency)}    tint="brand"   icon={<TrendingUp className="h-5 w-5" />} />
              <StatCard label="Collected"           value={formatMoney(stats.collected, displayCurrency)}    tint="emerald" icon={<Wallet className="h-5 w-5" />} />
              <StatCard label="Outstanding"         value={formatMoney(stats.outstanding, displayCurrency)} tint="amber"   icon={<FileText className="h-5 w-5" />} />
              <StatCard label="Of which overdue"    value={formatMoney(stats.overdue, displayCurrency)}      tint="rose"    icon={<FileText className="h-5 w-5" />} />
            </div>

            <section className="card mt-6 p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink-900">
                Billing <span className="font-normal text-ink-500">· {rangeLabel}</span>
              </h2>
              <div className="relative">
                <div className="flex h-56 items-end gap-1">
                  {buckets.map((m, i) => {
                    const invH = Math.max(2, Math.round((m.invoiced / maxBucket) * 100));
                    const colH = Math.max(2, Math.round((m.collected / maxBucket) * 100));
                    return (
                      <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-48 w-full items-end justify-center gap-0.5">
                          <div
                            className="w-2 rounded-t bg-brand-500"
                            style={{ height: `${invH}%` }}
                            title={`${m.label}: invoiced ${formatMoney(m.invoiced, displayCurrency)}`}
                          />
                          <div
                            className="w-2 rounded-t bg-emerald-500"
                            style={{ height: `${colH}%` }}
                            title={`${m.label}: collected ${formatMoney(m.collected, displayCurrency)}`}
                          />
                        </div>
                        <div
                          className={
                            "text-[10px] font-medium text-ink-500 " +
                            // Thin out labels on phones when there are many bars.
                            (buckets.length > 12 && i % 2 ? "invisible sm:visible" : "")
                          }
                        >
                          {m.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-ink-600">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-brand-500" /> Invoiced
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Collected
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
              <div className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink-900">
                  Outstanding by client
                </h2>
                {outstandingByClient.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    Nothing outstanding — everyone has paid.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {outstandingByClient.slice(0, 10).map((c) => (
                        <tr key={c.name + c.email} className="border-b border-ink-100 last:border-b-0">
                          <td className="py-2">
                            <div className="font-medium text-ink-900">{c.name}</div>
                            {c.email && <div className="text-xs text-ink-500">{c.email}</div>}
                          </td>
                          <td className="py-2 text-right text-xs text-ink-500">{c.invoiceCount} inv</td>
                          <td className="py-2 text-right font-medium text-amber-700">
                            {formatMoney(c.outstanding, displayCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-ink-900">
                  Tax collected <span className="font-normal text-ink-500">· paid invoices only</span>
                </h2>
                {taxByLabel.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    No tax collected on paid invoices yet.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {taxByLabel.map((t) => (
                        <tr key={t.label} className="border-b border-ink-100 last:border-b-0">
                          <td className="py-2 text-ink-900">{t.label}</td>
                          <td className="py-2 text-right font-medium text-ink-900">
                            {formatMoney(t.amount, displayCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tint,
  icon,
}: {
  label: string;
  value: string;
  tint: "brand" | "emerald" | "amber" | "rose";
  icon: React.ReactNode;
}) {
  const tintMap = {
    brand:   { bg: "bg-brand-50",   text: "text-brand-600" },
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
    amber:   { bg: "bg-amber-50",   text: "text-amber-600" },
    rose:    { bg: "bg-rose-50",    text: "text-rose-600" },
  };
  const t = tintMap[tint];
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${t.bg} ${t.text}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</div>
        <div className="text-lg font-bold text-ink-900">{value}</div>
      </div>
    </div>
  );
}
