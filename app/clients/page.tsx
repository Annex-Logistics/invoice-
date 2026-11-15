"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Mail, Phone, Plus, Search, Trash2, Users, Pencil, X, Check } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import type { Client, Invoice } from "@/lib/types";
import {
  createId,
  loadClients,
  loadInvoices,
  removeClient,
  upsertClient,
} from "@/lib/storage";
import { calcTotals } from "@/lib/totals";
import { matchClient } from "@/lib/clients";
import { formatMoney } from "@/lib/currencies";

type ClientStats = {
  invoiceCount: number;
  totalBilled: number;
  totalOutstanding: number;
  lastInvoice?: Invoice;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);

  useEffect(() => {
    setClients(loadClients());
    setInvoices(loadInvoices());
  }, []);

  const stats = useMemo(() => {
    const map = new Map<string, ClientStats>();
    for (const client of clients) {
      map.set(client.id, { invoiceCount: 0, totalBilled: 0, totalOutstanding: 0 });
    }
    // Attribute by stored clientId, falling back to email then name.
    for (const inv of invoices) {
      const match = matchClient(inv, clients);
      if (!match) continue;
      const totals = calcTotals(inv);
      const bucket = map.get(match.id)!;
      bucket.invoiceCount++;
      bucket.totalBilled += totals.total;
      if (inv.status !== "paid") bucket.totalOutstanding += totals.balanceDue;
      if (!bucket.lastInvoice || inv.updatedAt > bucket.lastInvoice.updatedAt) {
        bucket.lastInvoice = inv;
      }
    }
    return map;
  }, [clients, invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [clients, query]);

  function openNew() {
    setEditing({ id: "", name: "", email: "", phone: "", address: "", notes: "" });
  }

  function openEdit(c: Client) {
    setEditing({ ...c });
  }

  function saveEditing() {
    if (!editing) return;
    const c = { ...editing };
    if (!c.id) c.id = createId();
    upsertClient(c);
    setClients(loadClients());
    setEditing(null);
  }

  function deleteClient(id: string) {
    if (!confirm("Delete this client? Their invoices stay, but they'll no longer appear in the picker.")) return;
    removeClient(id);
    setClients(loadClients());
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">Clients</h1>
            <p className="text-sm text-ink-500">
              {clients.length} saved · pickable from the Bill-To section when you create an invoice.
            </p>
          </div>
          <button className="btn-primary" onClick={openNew}>
            <Plus className="h-4 w-4" />
            New client
          </button>
        </div>

        <div className="mb-4 flex justify-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              className="field pl-9 sm:w-72"
              placeholder="Search name, email, phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {clients.length === 0 ? (
          <div className="card flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <Users className="h-6 w-6 text-brand-600" />
            </div>
            <h3 className="text-sm font-semibold text-ink-900">No clients yet</h3>
            <p className="mt-1 max-w-sm text-xs text-ink-500">
              Add your first client to pick them straight into new invoices.
            </p>
            <button className="btn-primary mt-4" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Add client
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => {
              const s = stats.get(c.id) ?? { invoiceCount: 0, totalBilled: 0, totalOutstanding: 0 };
              return (
                <div key={c.id} className="card group p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink-900">
                        {c.name || <span className="italic text-ink-400">Unnamed</span>}
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(c)}
                        className="rounded p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteClient(c.id)}
                        className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Invoices</div>
                      <div className="text-sm font-semibold text-ink-900">{s.invoiceCount}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Outstanding</div>
                      <div
                        className={
                          "text-sm font-semibold " +
                          (s.totalOutstanding > 0 ? "text-amber-600" : "text-emerald-600")
                        }
                      >
                        {s.lastInvoice
                          ? formatMoney(s.totalOutstanding, s.lastInvoice.currency)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  {s.lastInvoice && (
                    <Link
                      href={`/invoices/${s.lastInvoice.id}`}
                      className="mt-3 inline-flex text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Open latest invoice →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <EditClientModal
          client={editing}
          onCancel={() => setEditing(null)}
          onChange={setEditing}
          onSave={saveEditing}
        />
      )}
    </AppShell>
  );
}

function EditClientModal({
  client,
  onChange,
  onCancel,
  onSave,
}: {
  client: Client;
  onChange: (c: Client) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const isNew = !client.id;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-16 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-ink-900">
            {isNew ? "New client" : "Edit client"}
          </h3>
          <button className="btn-ghost -mr-2" onClick={onCancel}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">
          <div>
            <label className="label">Name</label>
            <input
              autoFocus
              className="field"
              maxLength={200}
              value={client.name}
              onChange={(e) => onChange({ ...client, name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="field"
                maxLength={320}
                value={client.email}
                onChange={(e) => onChange({ ...client, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="field"
                maxLength={64}
                value={client.phone}
                onChange={(e) => onChange({ ...client, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea
              rows={3}
              className="field resize-none"
              maxLength={500}
              value={client.address}
              onChange={(e) => onChange({ ...client, address: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              rows={2}
              className="field resize-none"
              maxLength={1000}
              value={client.notes ?? ""}
              onChange={(e) => onChange({ ...client, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ink-100 p-3">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onSave}>
            <Check className="h-4 w-4" />
            {isNew ? "Add client" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
