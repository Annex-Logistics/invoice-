"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import type { Invoice } from "@/lib/types";
import { loadInvoice } from "@/lib/storage";

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const found = loadInvoice(id);
    if (!found) setNotFound(true);
    else setInvoice(found);
  }, [id]);

  if (notFound) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-ink-900">Invoice not found</h1>
          <p className="mt-2 text-sm text-ink-500">
            It may have been deleted, or stored in a different browser.
          </p>
          <button className="btn-primary mt-4" onClick={() => router.push("/invoices")}>
            Back to invoices
          </button>
        </div>
      </AppShell>
    );
  }

  if (!invoice) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-ink-500">
          Loading…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Key by id so navigating between invoices (e.g. after Duplicate)
          fully remounts the editor instead of reusing stale state. */}
      <InvoiceEditor key={invoice.id} initialInvoice={invoice} />
    </AppShell>
  );
}
