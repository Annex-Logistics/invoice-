"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, FileText, Plus, TrendingUp, Wallet, Clock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { DEFAULT_CURRENCY, formatMoney } from "@/lib/currencies";
import { currenciesByUse, summarize } from "@/lib/reports";
import { calcTotals } from "@/lib/totals";
import type { Invoice } from "@/lib/types";
import {
  getCurrentBusinessId,
  loadBusiness,
  loadCurrentInvoices,
  loadInvoices,
  saveBusiness,
  saveInvoices,
  todayISO,
} from "@/lib/storage";
import { sampleInvoices } from "@/lib/sample";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    setInvoices(loadCurrentInvoices());
  }, []);

  function loadSample() {
    const biz = loadBusiness();
    const samples = sampleInvoices();
    if (!biz.name) saveBusiness(samples[0].business);
    // Add to this business only; never touch other businesses' invoices.
    const businessId = getCurrentBusinessId();
    const stamped = samples.map((s) => ({ ...s, businessId }));
    const others = loadInvoices().filter((i) => i.businessId && i.businessId !== businessId);
    saveInvoices([...stamped, ...others]);
    setInvoices(stamped);
  }

  // Money tiles cover the most-used currency only: amounts in different
  // currencies can't be added up. Reports lets you pick the others.
  const currencies = useMemo(() => currenciesByUse(invoices), [invoices]);
  const displayCurrency = currencies[0] ?? DEFAULT_CURRENCY;
  const stats = useMemo(() => {
    const today = todayISO();
    const s = summarize(
      invoices.filter((inv) => inv.currency.code === displayCurrency.code),
      today
    );
    const overdueCount = invoices.filter(
      (inv) => inv.status !== "paid" && inv.dueDate && inv.dueDate < today
    ).length;
    return {
      totalInvoiced: s.invoiced,
      totalPaid: s.collected,
      totalOutstanding: s.outstanding,
      overdueCount,
    };
  }, [invoices, displayCurrency.code]);

  const recent = invoices.slice(0, 5);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
            <p className="text-sm text-ink-500">
              A quick look at your billing activity.
              {currencies.length > 1 && (
                <> Amounts are in {displayCurrency.code}; see Reports for other currencies.</>
              )}
            </p>
          </div>
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New invoice
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-brand-600" />}
            label="Total invoiced"
            value={formatMoney(stats.totalInvoiced, displayCurrency)}
            accent="bg-brand-50"
          />
          <StatCard
            icon={<Wallet className="h-5 w-5 text-emerald-600" />}
            label="Collected"
            value={formatMoney(stats.totalPaid, displayCurrency)}
            accent="bg-emerald-50"
          />
          <StatCard
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            label="Outstanding"
            value={formatMoney(stats.totalOutstanding, displayCurrency)}
            accent="bg-amber-50"
          />
          <StatCard
            icon={<FileText className="h-5 w-5 text-rose-600" />}
            label="Overdue"
            value={String(stats.overdueCount)}
            accent="bg-rose-50"
          />
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-900">Recent invoices</h2>
          <Link href="/invoices" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-3">
          {recent.length === 0 ? (
            <EmptyState onLoadSample={loadSample} />
          ) : (
            <InvoiceCompactList invoices={recent} />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-md ${accent}`}>{icon}</div>
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</div>
        <div className="text-lg font-bold text-ink-900">{value}</div>
      </div>
    </div>
  );
}

function InvoiceCompactList({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-ink-100">
        {invoices.map((inv) => {
          const t = calcTotals(inv);
          return (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50/70"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink-900">
                      {inv.number}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <div className="truncate text-xs text-ink-500">
                    {inv.billTo.name || "No client"} · due {inv.dueDate}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-ink-900">
                    {formatMoney(t.total, inv.currency)}
                  </div>
                  <div className="text-xs text-ink-500">
                    {inv.status === "paid"
                      ? "paid"
                      : `${formatMoney(t.balanceDue, inv.currency)} due`}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EmptyState({ onLoadSample }: { onLoadSample: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center p-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
        <FileText className="h-6 w-6 text-brand-600" />
      </div>
      <h3 className="text-sm font-semibold text-ink-900">No invoices yet</h3>
      <p className="mt-1 max-w-sm text-xs text-ink-500">
        Create your first invoice in under a minute — add your business info, line items, and
        send a polished PDF to your client.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Link href="/invoices/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          Create invoice
        </Link>
        <button type="button" className="btn-secondary" onClick={onLoadSample}>
          Load sample data
        </button>
      </div>
    </div>
  );
}
