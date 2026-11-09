"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import type { Invoice } from "@/lib/types";
import { newInvoice } from "@/lib/storage";

export default function NewInvoicePage() {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  // Guard against React StrictMode's dev-only double-effect which would
  // otherwise burn an invoice number (the counter is bumped eagerly).
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    setInvoice(newInvoice());
  }, []);

  if (!invoice) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-ink-500">
          Preparing a fresh invoice…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <InvoiceEditor initialInvoice={invoice} isNew />
    </AppShell>
  );
}
