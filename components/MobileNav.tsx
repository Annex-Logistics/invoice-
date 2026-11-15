"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  BarChart3,
  FileCheck,
  FileText,
  LayoutDashboard,
  MoreHorizontal,
  Plus,
  Receipt,
  Repeat,
  Settings,
  Truck,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import { BusinessSwitcher } from "./BusinessSwitcher";

const items = [
  { href: "/",          label: "Home",      icon: LayoutDashboard },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
  { href: "/estimates", label: "Estimates", icon: FileCheck },
  { href: "/reports",   label: "Reports",   icon: BarChart3 },
];

// Everything that doesn't fit in the bottom bar.
const more = [
  { href: "/receipts",       label: "Receipts",       icon: Receipt },
  { href: "/delivery-notes", label: "Delivery notes", icon: Truck },
  { href: "/recurring",      label: "Recurring",      icon: Repeat },
  { href: "/clients",        label: "Clients",        icon: Users },
  { href: "/settings",       label: "Settings",       icon: Settings },
];

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

export function MobileNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const moreActive = more.some((m) => isActive(pathname, m.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tab = "flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-medium";

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-ink-100 bg-white px-4 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <BusinessSwitcher compact />
          <Link href="/invoices/new" className="btn-primary !px-3 !py-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            New
          </Link>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/50" />
          <div
            role="menu"
            aria-label="More pages"
            className="absolute inset-x-2 bottom-16 rounded-xl bg-white p-2 shadow-pop ring-1 ring-ink-100"
            onClick={(e) => e.stopPropagation()}
          >
            {more.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                  isActive(pathname, href) ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-50"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-ink-100 bg-white px-2 py-1 md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href) && !open;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(tab, active ? "text-brand-700" : "text-ink-500")}
            >
              <Icon className={clsx("h-5 w-5", active ? "text-brand-600" : "text-ink-400")} />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={clsx(tab, open || moreActive ? "text-brand-700" : "text-ink-500")}
        >
          <MoreHorizontal className={clsx("h-5 w-5", open || moreActive ? "text-brand-600" : "text-ink-400")} />
          More
        </button>
      </nav>
    </>
  );
}
