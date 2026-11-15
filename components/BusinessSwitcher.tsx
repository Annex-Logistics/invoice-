"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import type { BusinessProfile } from "@/lib/types";
import { addBusiness, getCurrentBusinessId, listBusinesses, switchBusiness } from "@/lib/storage";

// Every page reads storage once on mount, so after switching or adding a
// business we reload: the simplest way to guarantee nothing shows the
// previous business's data.
function reloadPage() {
  window.location.reload();
}

export function BusinessSwitcher({ compact = false }: { compact?: boolean }) {
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfiles(listBusinesses());
    setCurrentId(getCurrentBusinessId());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = profiles.find((p) => p.id === currentId);
  const name = (p?: BusinessProfile) => p?.business.name.trim() || "Untitled business";

  function pick(id: string) {
    setOpen(false);
    if (id === currentId) return;
    if (switchBusiness(id)) reloadPage();
  }

  function add() {
    const entered = window.prompt("Name of the new business:");
    if (entered === null) return;
    addBusiness(entered || "New business");
    reloadPage();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Business: ${name(current)}. Switch business`}
        className={
          compact
            ? "inline-flex max-w-[11rem] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
            : "flex w-full items-center gap-2 rounded-md border border-ink-100 px-3 py-2 text-left text-sm hover:bg-ink-50"
        }
      >
        <Building2 className="h-4 w-4 flex-none text-ink-500" />
        <span className="min-w-0 flex-1 truncate font-medium text-ink-900">{name(current)}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 flex-none text-ink-400" />
      </button>

      {open && (
        <div
          role="menu"
          className={
            "absolute z-50 mt-1 w-64 overflow-hidden rounded-lg bg-white py-1 shadow-pop ring-1 ring-ink-100 " +
            (compact ? "right-0" : "left-0")
          }
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
            Businesses
          </div>
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === currentId}
              onClick={() => pick(p.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-800 hover:bg-ink-50"
            >
              <span className="min-w-0 flex-1 truncate">{name(p)}</span>
              {p.id === currentId && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
          <div className="my-1 border-t border-ink-100" />
          <button
            type="button"
            role="menuitem"
            onClick={add}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand-700 hover:bg-ink-50"
          >
            <Plus className="h-4 w-4" /> Add business
          </button>
          <Link
            href="/settings#businesses"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
          >
            <Settings className="h-4 w-4" /> Manage businesses
          </Link>
        </div>
      )}
    </div>
  );
}
