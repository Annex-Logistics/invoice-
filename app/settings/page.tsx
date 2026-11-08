"use client";

import { useEffect, useState } from "react";
import { Check, Save, Download, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LogoUpload } from "@/components/LogoUpload";
import type { Business } from "@/lib/types";
import {
  emptyBusiness,
  loadBusiness,
  loadInvoices,
  saveBusiness,
  saveInvoices,
} from "@/lib/storage";

export default function SettingsPage() {
  const [business, setBusiness] = useState<Business>(emptyBusiness());
  const [savedAt, setSavedAt] = useState<string>("");

  useEffect(() => {
    setBusiness(loadBusiness());
  }, []);

  function patch(p: Partial<Business>) {
    setBusiness((prev) => ({ ...prev, ...p }));
  }

  function save() {
    saveBusiness(business);
    setSavedAt(new Date().toLocaleTimeString());
  }

  function exportData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "AnnexInvoice",
      business: loadBusiness(),
      invoices: loadInvoices(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annexinvoice-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.business) {
          saveBusiness(data.business);
          setBusiness(data.business);
        }
        if (Array.isArray(data.invoices)) {
          saveInvoices(data.invoices);
        }
        alert("Imported successfully.");
      } catch {
        alert("Could not read the file — is it a valid AnnexInvoice backup?");
      }
    };
    reader.readAsText(file);
  }

  function resetAll() {
    if (!confirm("Erase all invoices and business info? This cannot be undone.")) return;
    saveInvoices([]);
    saveBusiness(emptyBusiness());
    setBusiness(emptyBusiness());
    alert("Everything has been cleared from this browser.");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 md:py-8">
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Your business details appear on every invoice.</p>

        <section className="card mt-6 p-5">
          <div className="mb-4 flex items-center gap-4">
            <LogoUpload value={business.logoDataUrl} onChange={(d) => patch({ logoDataUrl: d })} />
            <div>
              <h2 className="text-sm font-semibold text-ink-900">Brand</h2>
              <p className="text-xs text-ink-500">PNG, JPG or SVG. Shown top-left on invoices.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Business name">
              <input className="field" value={business.name}
                onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Website">
              <input className="field" value={business.website}
                onChange={(e) => patch({ website: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="field" type="email" value={business.email}
                onChange={(e) => patch({ email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="field" value={business.phone}
                onChange={(e) => patch({ phone: e.target.value })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Address">
                <textarea rows={3} className="field resize-none" value={business.address}
                  onChange={(e) => patch({ address: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button className="btn-primary" onClick={save}>
              <Save className="h-4 w-4" /> Save business info
            </button>
            {savedAt && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" /> Saved at {savedAt}
              </span>
            )}
          </div>
        </section>

        <section className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-ink-900">Data</h2>
          <p className="mt-1 text-xs text-ink-500">
            Your invoices live in this browser. Back them up so you don't lose them.
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
