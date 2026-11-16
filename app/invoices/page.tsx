"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, FileText, Repeat } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { loadCurrentInvoices } from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/currencies";

const STATUS_TABS: Array<{ key: "all" | InvoiceStatus; label: string }> = [
  { key: "all",     label: "All" },
  { key: "draft",   label: "Draft" },
  { key: "sent",    label: "Sent" },
  { key: "paid",    label: "Paid" },
  { key: "overdue", label: "Overdue" },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setInvoices(loadCurrentInvoices());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (status !== "all" && inv.status !== status) return false;
      if (!q) return true;
      const t = calcTotals(inv);
      return (
        inv.number.toLowerCase().includes(q) ||
        inv.billTo.name.toLowerCase().includes(q) ||
        inv.billTo.email.toLowerCase().includes(q) ||
        String(t.total).includes(q)
      );
    });
  }, [invoices, status, query]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Invoices</h1>
            <p className="text-sm text-ink-500">
              {invoices.length} total · {invoices.filter((i) => i.status !== "paid").length} open
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/recurring" className="btn-secondary">
              <Repeat className="h-4 w-4" />
              Recurring
            </Link>
            <Link href="/invoices/new" className="btn-primary">
              <Plus className="h-4 w-4" />
              New invoice
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-white p-1 shadow-card ring-1 ring-ink-100">
            {STATUS_TABS.map((tab) => {
              const active = status === tab.key;
              const count =
                tab.key === "all"
                  ? invoices.length
                  : invoices.filter((i) => i.status === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                    (active
                      ? "bg-brand-600 text-white"
                      : "text-ink-600 hover:bg-ink-50 hover:text-ink-900")
                  }
                >
                  {tab.label}
                  <span className={"ml-1.5 text-[10px] " + (active ? "text-brand-100" : "text-ink-400")}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="field pl-9 sm:w-72"
              placeholder="Search by number, client, amount…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyList invoiceCount={invoices.length} />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/70 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const t = calcTotals(inv);
                  return (
                    <tr key={inv.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-semibold text-brand-700 hover:text-brand-800"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900">
                          {inv.billTo.name || <span className="text-ink-400">—</span>}
                        </div>
                        <div className="text-xs text-ink-500">{inv.billTo.email}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{inv.issueDate}</td>
                      <td className="px-4 py-3 text-ink-700">{inv.dueDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 text-right font-medium text-ink-900">
                        {formatMoney(t.total, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={inv.status === "paid" ? "text-emerald-600" : "font-medium text-ink-900"}>
                          {inv.status === "paid" ? "Paid" : formatMoney(t.balanceDue, inv.currency)}
                        </span>
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

function EmptyList({ invoiceCount }: { invoiceCount: number }) {
  return (
    <div className="card flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
        <FileText className="h-6 w-6 text-brand-600" />
      </div>
      <h3 className="text-sm font-semibold text-ink-900">
        {invoiceCount === 0 ? "No invoices yet" : "No matches"}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-ink-500">
        {invoiceCount === 0
          ? "Create your first invoice — your business info stays, so the next one is even faster."
          : "Try a different search or status filter."}
      </p>
      {invoiceCount === 0 && (
        <Link href="/invoices/new" className="btn-primary mt-4">
          <Plus className="h-4 w-4" />
          Create invoice
        </Link>
      )}
    </div>
  );
}
