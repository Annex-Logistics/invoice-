"use client";

import { useEffect, useState } from "react";
import { Check, Save, Download, Trash2, Upload, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoUpload } from "@/components/LogoUpload";
import type { Business, BusinessProfile, Invoice, InvoicePrefs, SavedItem } from "@/lib/types";
import { CURRENCIES } from "@/lib/currencies";
import {
  addBusiness,
  businessDocCount,
  clearBusinesses,
  getCurrentBusinessId,
  listBusinesses,
  removeBusiness,
  restoreBusinesses,
  switchBusiness,
  createId,
  defaultPrefs,
  emptyBusiness,
  loadBusiness,
  loadClients,
  loadEstimates,
  loadInvoices,
  loadItems,
  loadPrefs,
  loadSchedules,
  removeItem,
  saveBusiness,
  saveClients,
  saveEstimates,
  saveInvoices,
  saveItems,
  savePrefs,
  saveSchedules,
  todayISO,
  upsertItem,
} from "@/lib/storage";
import { parseBackup } from "@/lib/import";

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business>(emptyBusiness());
  const [prefs, setPrefs] = useState<InvoicePrefs>(defaultPrefs());
  const [items, setItems] = useState<SavedItem[]>([]);
  const [newDescription, setNewDescription] = useState("");
  const [newRate, setNewRate] = useState<number | "">("");
  const [savedAt, setSavedAt] = useState<string>("");
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [currentBusinessId, setCurrentBusinessId] = useState("");

  useEffect(() => {
    setBusiness(loadBusiness());
    setPrefs(loadPrefs());
    setItems(loadItems());
    setProfiles(listBusinesses());
    setCurrentBusinessId(getCurrentBusinessId());
  }, []);

  function switchTo(id: string) {
    if (switchBusiness(id)) window.location.reload();
  }

  function addNewBusiness() {
    const entered = window.prompt("Name of the new business:");
    if (entered === null) return;
    addBusiness(entered || "New business");
    window.location.reload();
  }

  function deleteBusiness(p: BusinessProfile) {
    if (!confirm(`Delete "${p.business.name || "Untitled business"}"? It has no documents.`)) return;
    if (removeBusiness(p.id)) setProfiles(listBusinesses());
  }

  function patchBiz(p: Partial<Business>) {
    setBusiness((prev) => ({ ...prev, ...p }));
  }

  function patchPrefs(p: Partial<InvoicePrefs>) {
    setPrefs((prev) => ({ ...prev, ...p }));
  }

  function saveAll() {
    saveBusiness(business);
    savePrefs(prefs);
    setSavedAt(new Date().toLocaleTimeString());
  }

  function addItem() {
    if (!newDescription.trim() || !newRate) return;
    const item = { id: createId(), description: newDescription.trim(), rate: Number(newRate) };
    upsertItem(item);
    setItems((prev) => [item, ...prev]);
    setNewDescription("");
    setNewRate("");
  }

  function deleteItem(id: string) {
    removeItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "AnnexInvoice",
      version: 3,
      currentBusinessId: getCurrentBusinessId(),
      businesses: listBusinesses(),
      business: loadBusiness(),
      prefs: loadPrefs(),
      items: loadItems(),
      invoices: loadInvoices(),
      estimates: loadEstimates(),
      clients: loadClients(),
      recurring: loadSchedules(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annexinvoice-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    // Soft cap on the file we'll read into memory before parsing.
    // A real backup even with hundreds of invoices and logos is well
    // under this; the limit keeps a malicious or accidental multi-GB
    // JSON from locking up the tab.
    const MAX_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      alert("That backup file is too large to import (max 20 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = parseBackup(String(reader.result));
        // A full (v3) backup restores every business. An older
        // single-business backup only replaces the ACTIVE business's
        // documents; other businesses are left alone.
        const multi = !!result.businesses;
        const currentId = getCurrentBusinessId();
        const mergeDocs = (incoming: Invoice[], existing: Invoice[]) =>
          multi
            ? incoming
            : [
                ...incoming.map((d) => ({ ...d, businessId: currentId })),
                ...existing.filter((d) => d.businessId && d.businessId !== currentId),
              ];
        if (result.businesses) {
          restoreBusinesses(result.businesses, result.currentBusinessId);
          setBusiness(loadBusiness());
          setPrefs(loadPrefs());
          setProfiles(listBusinesses());
          setCurrentBusinessId(getCurrentBusinessId());
        } else if (result.business) {
          saveBusiness(result.business);
          setBusiness(result.business);
        }
        if (result.prefs && !multi) {
          savePrefs(result.prefs);
          setPrefs(result.prefs);
        }
        if (result.items) {
          saveItems(result.items);
          setItems(result.items);
        }
        if (result.invoices) {
          saveInvoices(mergeDocs(result.invoices, loadInvoices()));
        }
        if (result.estimates) {
          saveEstimates(mergeDocs(result.estimates, loadEstimates()));
        }
        if (result.clients) {
          saveClients(result.clients);
        }
        if (result.recurring) {
          saveSchedules(result.recurring);
        }
        const msg =
          "Imported successfully." +
          (result.warnings.length ? "\n\n" + result.warnings.join("\n") : "");
        alert(msg);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not read the file.");
      }
    };
    reader.onerror = () => alert("Could not read the file.");
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm("Erase all businesses, invoices, estimates, clients, recurring schedules, items, business info, and preferences? This cannot be undone.")) return;
    saveInvoices([]);
    saveEstimates([]);
    saveClients([]);
    saveSchedules([]);
    clearBusinesses();
    saveItems([]);
    savePrefs(defaultPrefs());
    saveBusiness(emptyBusiness());
    setBusiness(emptyBusiness());
    setPrefs(defaultPrefs());
    setItems([]);
    setProfiles(listBusinesses());
    setCurrentBusinessId(getCurrentBusinessId());
    alert("Everything has been cleared from this browser.");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Your business details and defaults appear on every invoice.</p>

        <section className="card mt-6 p-5">
          <div className="mb-4 flex items-center gap-4">
            <LogoUpload value={business.logoDataUrl} onChange={(d) => patchBiz({ logoDataUrl: d })} />
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Brand</h2>
              <p className="text-xs text-ink-500">PNG, JPG or SVG. Shown top-left on invoices and in the PDF.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Business name">
              <input className="field" value={business.name}
                onChange={(e) => patchBiz({ name: e.target.value })} />
            </Field>
            <Field label="Website">
              <input className="field" value={business.website}
                onChange={(e) => patchBiz({ website: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={business.email}
                onChange={(e) => patchBiz({ email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="field" value={business.phone}
                onChange={(e) => patchBiz({ phone: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Address">
                <textarea rows={3} className="field resize-none" value={business.address}
                  onChange={(e) => patchBiz({ address: e.target.value })} />
              </Field>
            </div>
          </div>
        </section>

        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Invoice defaults</h2>
          <p className="text-xs text-ink-500">Applied to every newly created invoice.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Number prefix">
              <input className="field" value={prefs.numberPrefix}
                onChange={(e) => patchPrefs({ numberPrefix: e.target.value })} />
            </Field>
            <Field label="Next number">
              <input className="field" type="number" min={1} value={prefs.nextNumber}
                onChange={(e) => patchPrefs({ nextNumber: parseInt(e.target.value, 10) || 1 })} />
            </Field>
            <Field label="Number padding (digits)">
              <input className="field" type="number" min={1} max={8} value={prefs.numberPadding}
                onChange={(e) => patchPrefs({ numberPadding: parseInt(e.target.value, 10) || 4 })} />
            </Field>
            <Field label="Due in (days)">
              <input className="field" type="number" min={0} value={prefs.defaultDueDays}
                onChange={(e) => patchPrefs({ defaultDueDays: parseInt(e.target.value, 10) || 14 })} />
            </Field>
            <Field label="Default currency">
              <select className="field" value={prefs.defaultCurrencyCode}
                onChange={(e) => patchPrefs({ defaultCurrencyCode: e.target.value })}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Default tax label">
              <input className="field" value={prefs.defaultTaxLabel}
                onChange={(e) => patchPrefs({ defaultTaxLabel: e.target.value })} />
            </Field>
            <Field label="Default tax (%)">
              <input className="field" type="number" min={0} step="any" value={prefs.defaultTaxPercent}
                onChange={(e) => patchPrefs({ defaultTaxPercent: parseFloat(e.target.value) || 0 })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Default terms">
                <textarea rows={2} className="field resize-none" value={prefs.defaultTerms}
                  onChange={(e) => patchPrefs({ defaultTerms: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary" onClick={saveAll}>
              <Save className="h-4 w-4" /> Save settings
            </button>
            {savedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" /> Saved at {savedAt}
              </span>
            )}
            <span className="ml-auto text-xs text-ink-400">
              Next invoice: <code className="font-mono">{prefs.numberPrefix}{String(prefs.nextNumber).padStart(prefs.numberPadding, "0")}</code>
            </span>
          </div>
        </section>

        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Item library</h2>
          <p className="text-xs text-ink-500">
            Save common line items for one-click insertion into new invoices.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="field flex-1"
              placeholder="Item description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
            />
            <input
              className="field sm:w-32"
              type="number"
              min={0}
              step="any"
              placeholder="Rate"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value === "" ? "" : parseFloat(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
            />
            <button className="btn-primary sm:w-auto" onClick={addItem}>
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          {items.length > 0 && (
            <ul className="mt-4 divide-y divide-ink-100 rounded-md border border-ink-100">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink-900">{item.description}</div>
                    <div className="text-xs text-ink-500">Rate: {item.rate}</div>
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Delete ${item.description}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="businesses" className="card mt-6 scroll-mt-6 p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Businesses</h2>
              <p className="mt-1 text-xs text-ink-500">
                Invoice as more than one business. Each has its own brand, numbering, defaults,
                invoices and estimates; clients and saved items are shared. The Brand and default
                sections above edit the active business.
              </p>
            </div>
            <button className="btn-secondary flex-none" onClick={addNewBusiness}>
              <Plus className="h-4 w-4" /> Add business
            </button>
          </div>
          <ul className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-100">
            {profiles.map((p) => {
              const isCurrent = p.id === currentBusinessId;
              const docs = isCurrent ? null : businessDocCount(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                    {p.business.name || "Untitled business"}
                  </span>
                  {isCurrent ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      Active
                    </span>
                  ) : (
                    <>
                      <span className="text-xs text-ink-500">
                        {docs} document{docs === 1 ? "" : "s"}
                      </span>
                      <button className="btn-ghost !py-1 text-xs" onClick={() => switchTo(p.id)}>
                        Switch
                      </button>
                      <button
                        className="btn-ghost !px-2 !py-1 text-ink-400 hover:text-rose-600 disabled:opacity-40"
                        onClick={() => deleteBusiness(p)}
                        disabled={(docs ?? 0) > 0}
                        aria-label={`Delete ${p.business.name || "Untitled business"}`}
                        title={(docs ?? 0) > 0 ? "Only a business with no documents can be deleted" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Data</h2>
          <p className="mt-1 text-xs text-ink-500">
            Your invoices live in this browser. Back them up so you don&apos;t lose them.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={exportData}>
              <Download className="h-4 w-4" /> Export backup
            </button>
            <label className="btn-secondary cursor-pointer">
              <Upload className="h-4 w-4" /> Import backup
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
              />
            </label>
            <button className="btn-danger" onClick={resetAll}>
              <Trash2 className="h-4 w-4" /> Reset everything
            </button>
          </div>
        </section>

        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink-900">About</h2>
          <p className="mt-1 text-xs text-ink-500">
            AnnexInvoice is a free, browser-based invoice builder by Annex Logistics.
            Everything runs locally — no account, no server, no tracking.
          </p>
          <p className="mt-2 text-xs text-ink-500">
            Keyboard shortcuts: <kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px]">N</kbd> new invoice,
            {" "}<kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px]">g</kbd> then
            {" "}<kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px]">d</kbd>/<kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px]">i</kbd>/<kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px]">c</kbd>/<kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px]">s</kbd>
            {" "}to jump between pages.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
