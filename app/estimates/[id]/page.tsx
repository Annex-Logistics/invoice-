"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { InvoiceEditor } from "@/components/InvoiceEditor";
import type { Invoice } from "@/lib/types";
import { loadEstimate } from "@/lib/storage";

export default function EditEstimatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [estimate, setEstimate] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    const found = loadEstimate(id);
    if (!found) setNotFound(true);
    else setEstimate(found);
  }, [id]);

  if (notFound) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-ink-900">Estimate not found</h1>
          <p className="mt-2 text-sm text-ink-500">
            It may have been deleted, or stored in a different browser.
          </p>
          <button className="btn-primary mt-4" onClick={() => router.push("/estimates")}>
            Back to estimates
          </button>
        </div>
      </AppShell>
    );
  }

  if (!estimate) {
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
      <InvoiceEditor key={estimate.id} initialInvoice={estimate} />
    </AppShell>
  );
}
