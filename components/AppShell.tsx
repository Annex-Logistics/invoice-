"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Repeat, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { KeyboardShortcuts } from "./KeyboardShortcuts";
import { runDueSchedules } from "@/lib/storage";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [generated, setGenerated] = useState(0);

  // No backend scheduler: create any recurring invoices that came due
  // since the last visit. Child effects run before their parents', so
  // this finishes before the page's own effect loads its data.
  useEffect(() => {
    setGenerated(runDueSchedules());
  }, []);

  return (
    <div className="flex min-h-screen bg-ink-50">
      <KeyboardShortcuts />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <MobileNav />
        {generated > 0 && (
          <div
            role="status"
            className="no-print flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2 text-sm text-brand-800"
          >
            <Repeat className="h-4 w-4 flex-none" />
            <span>
              Created {generated} recurring invoice{generated === 1 ? "" : "s"} as draft
              {generated === 1 ? "" : "s"}.{" "}
              <Link href="/invoices" className="font-semibold underline">Review</Link>
            </span>
            <button
              className="ml-auto rounded p-1 hover:bg-brand-100"
              onClick={() => setGenerated(0)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
