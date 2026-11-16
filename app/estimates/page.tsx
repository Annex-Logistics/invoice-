"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import type { Invoice, DocumentStatus } from "@/lib/types";
import { loadCurrentEstimates } from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/currencies";

const STATUS_TABS: Array<{ key: "all" | DocumentStatus; label: string }> = [
  { key: "all",      label: "All" },
  { key: "draft",    label: "Draft" },
  { key: "sent",     label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
];

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<"all" | DocumentStatus>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setEstimates(loadCurrentEstimates());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return estimates.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (!q) return true;
      const t = calcTotals(e);
      return (
        e.number.toLowerCase().includes(q) ||
        e.billTo.name.toLowerCase().includes(q) ||
        e.billTo.email.toLowerCase().includes(q) ||
        String(t.total).includes(q)
      );
    });
  }, [estimates, status, query]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Estimates</h1>
            <p className="text-sm text-ink-500">
              {estimates.length} total · {estimates.filter((e) => e.status !== "accepted" && e.status !== "declined").length} open
            </p>
          </div>
          <Link href="/estimates/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New estimate
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-white p-1 shadow-card ring-1 ring-ink-100">
            {STATUS_TABS.map((tab) => {
              const active = status === tab.key;
              const count =
                tab.key === "all"
                  ? estimates.length
                  : estimates.filter((e) => e.status === tab.key).length;
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
          <EmptyList count={estimates.length} />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/70 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Estimate</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Valid until</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const t = calcTotals(e);
                  return (
                    <tr key={e.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/estimates/${e.id}`}
                          className="font-semibold text-brand-700 hover:text-brand-800"
                        >
                          {e.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900">
                          {e.billTo.name || <span className="text-ink-400">—</span>}
                        </div>
                        <div className="text-xs text-ink-500">{e.billTo.email}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-700">{e.issueDate}</td>
                      <td className="px-4 py-3 text-ink-700">{e.dueDate}</td>
                      <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-3 text-right font-medium text-ink-900">
                        {formatMoney(t.total, e.currency)}
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

function EmptyList({ count }: { count: number }) {
  return (
    <div className="card flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
        <FileText className="h-6 w-6 text-brand-600" />
      </div>
      <h3 className="text-sm font-semibold text-ink-900">
        {count === 0 ? "No estimates yet" : "No matches"}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-ink-500">
        {count === 0
          ? "Create a quote to send to a prospect. When they accept it, convert it to an invoice with one click."
          : "Try a different search or status filter."}
      </p>
      {count === 0 && (
        <Link href="/estimates/new" className="btn-primary mt-4">
          <Plus className="h-4 w-4" />
          Create estimate
        </Link>
      )}
    </div>
  );
}
