"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import type { Invoice } from "@/lib/types";
import { newEstimate } from "@/lib/storage";

export default function NewEstimatePage() {
  const [estimate, setEstimate] = useState<Invoice | null>(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    setEstimate(newEstimate());
  }, []);

  if (!estimate) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-10 text-center text-sm text-ink-500">
          Preparing a fresh estimate…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <InvoiceEditor initialInvoice={estimate} isNew />
    </AppShell>
  );
}
