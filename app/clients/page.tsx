"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Mail, Phone, FileText, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { loadInvoices } from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/currencies";
import type { Invoice } from "@/lib/types";

type ClientRow = {
  key: string;
  name: string;
  email: string;
  phone: string;
  invoiceCount: number;
  totalBilled: number;
  totalOutstanding: number;
  lastInvoice: Invoice;
};

export default function ClientsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    setInvoices(loadInvoices());
  }, []);

  const clients = useMemo(() => {
    const map = new Map<string, ClientRow>();
    invoices.forEach((inv) => {
      const key = (inv.billTo.email || inv.billTo.name || "unknown").toLowerCase().trim();
      if (!key || key === "unknown") return;
      const totals = calcTotals(inv);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          name: inv.billTo.name || inv.billTo.email || "Unnamed",
          email: inv.billTo.email,
          phone: inv.billTo.phone,
          invoiceCount: 1,
          totalBilled: totals.total,
          totalOutstanding: inv.status === "paid" ? 0 : totals.balanceDue,
          lastInvoice: inv,
        });
      } else {
        existing.invoiceCount++;
        existing.totalBilled += totals.total;
        existing.totalOutstanding += inv.status === "paid" ? 0 : totals.balanceDue;
        if (inv.updatedAt > existing.lastInvoice.updatedAt) existing.lastInvoice = inv;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalBilled - a.totalBilled);
  }, [invoices]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Clients</h1>
            <p className="text-sm text-ink-500">
              Automatically compiled from your invoices — {clients.length} unique clients.
            </p>
          </div>
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New invoice
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="card flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Users className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-ink-900">No clients yet</h3>
            <p className="mt-1 max-w-sm text-xs text-ink-500">
              Clients show up here the moment you add them to an invoice.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <Link
                key={c.key}
                href={`/invoices/${c.lastInvoice.id}`}
                className="card group p-4 transition-shadow hover:shadow-pop"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-ink-900 group-hover:text-brand-700">
                      {c.name}
                    </div>
                    {c.email && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
                        <Mail className="h-3 w-3" /> {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="inline-flex items-center gap-1 text-xs text-ink-500">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </div>
                    )}
                  </div>
                  <span className="chip bg-ink-100 text-ink-700">
                    <FileText className="h-3 w-3" /> {c.invoiceCount}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      Billed
                    </div>
                    <div className="text-sm font-semibold text-ink-900">
                      {formatMoney(c.totalBilled, c.lastInvoice.currency)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                      Outstanding
                    </div>
                    <div
                      className={
                        "text-sm font-semibold " +
                        (c.totalOutstanding > 0 ? "text-amber-600" : "text-emerald-600")
                      }
                    >
                      {formatMoney(c.totalOutstanding, c.lastInvoice.currency)}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
