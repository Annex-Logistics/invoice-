"use client";

// Shared list / new / edit pages for the document kinds that follow the
// generic store (receipts, delivery notes). Each route file is a
// one-liner passing its kind. Invoices and estimates still have their
// own older pages.

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Plus, Search } from "lucide-react";
import { AppShell } from "./AppShell";
import { InvoiceEditor } from "./InvoiceEditor";
import { StatusBadge } from "./StatusBadge";
import type { DocumentKind, DocumentStatus, Invoice } from "@/lib/types";
import { loadCurrentDocs, loadDoc, newDocument } from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { formatMoney } from "@/lib/currencies";
import { docType } from "@/lib/docTypes";

export function DocumentListPage({ kind }: { kind: DocumentKind }) {
  const cfg = docType(kind);
  const [docs, setDocs] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<"all" | DocumentStatus>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setDocs(loadCurrentDocs(kind));
  }, [kind]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        d.billTo.name.toLowerCase().includes(q) ||
        d.billTo.email.toLowerCase().includes(q) ||
        (d.sourceNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [docs, status, query]);

  const tabs: Array<"all" | DocumentStatus> = ["all", ...cfg.statuses];
  const noun = cfg.label.toLowerCase();

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">{cfg.plural}</h1>
            <p className="text-sm text-ink-500">{docs.length} total</p>
          </div>
          <Link href={`${cfg.path}/new`} className="btn-primary">
            <Plus className="h-4 w-4" />
            New {noun}
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-white p-1 shadow-card ring-1 ring-ink-100">
            {tabs.map((tab) => {
              const active = status === tab;
              const count = tab === "all" ? docs.length : docs.filter((d) => d.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setStatus(tab)}
                  className={
                    "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors " +
                    (active ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50 hover:text-ink-900")
                  }
                >
                  {tab}
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
              placeholder="Search by number or client…"
              aria-label={`Search ${cfg.plural.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <FileText className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-ink-900">
              {docs.length === 0 ? `No ${cfg.plural.toLowerCase()} yet` : "No matches"}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-ink-500">
              {docs.length === 0 ? cfg.emptyHint : "Try a different search or status filter."}
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50/70 text-left text-[10px] uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">{cfg.label}</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Status</th>
                  {cfg.prices && <th className="px-4 py-3 text-right">Total</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <Link href={`${cfg.path}/${d.id}`} className="font-semibold text-brand-700 hover:text-brand-800">
                        {d.number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">
                        {d.billTo.name || <span className="text-ink-400">—</span>}
                      </div>
                      <div className="text-xs text-ink-500">{d.billTo.email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{d.issueDate}</td>
                    <td className="px-4 py-3 text-ink-700">{d.sourceNumber || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                    {cfg.prices && (
                      <td className="px-4 py-3 text-right font-medium text-ink-900">
                        {formatMoney(calcTotals(d).total, d.currency)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-ink-500">{children}</div>
    </AppShell>
  );
}

export function NewDocumentPage({ kind }: { kind: DocumentKind }) {
  const [doc, setDoc] = useState<Invoice | null>(null);
  // StrictMode double-runs effects in dev; without this guard each visit
  // would burn two numbers.
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    setDoc(newDocument(kind));
  }, [kind]);

  if (!doc) return <Centered>Preparing a fresh {docType(kind).label.toLowerCase()}…</Centered>;
  return (
    <AppShell>
      <InvoiceEditor initialInvoice={doc} isNew />
    </AppShell>
  );
}

export function EditDocumentPage({ kind }: { kind: DocumentKind }) {
  const cfg = docType(kind);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const found = loadDoc(kind, id);
    if (found) setDoc(found);
    else setNotFound(true);
  }, [id, kind]);

  if (notFound) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-ink-900">{cfg.label} not found</h1>
          <p className="mt-2 text-sm text-ink-500">
            It may have been deleted, or stored in a different browser.
          </p>
          <button className="btn-primary mt-4" onClick={() => router.push(cfg.path)}>
            Back to {cfg.plural.toLowerCase()}
          </button>
        </div>
      </AppShell>
    );
  }
  if (!doc) return <Centered>Loading…</Centered>;
  return (
    <AppShell>
      {/* Keyed so moving between documents remounts the editor. */}
      <InvoiceEditor key={doc.id} initialInvoice={doc} />
    </AppShell>
  );
}
