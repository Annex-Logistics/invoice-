"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BarChart3,
  FileCheck,
  FileText,
  LayoutDashboard,
  Plus,
  Repeat,
  Settings,
  Users,
  HelpCircle,
} from "lucide-react";
import { Logo } from "./Logo";
import { BusinessSwitcher } from "./BusinessSwitcher";

const nav = [
  { href: "/",          label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
  { href: "/estimates", label: "Estimates", icon: FileCheck },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/clients",   label: "Clients",   icon: Users },
  { href: "/reports",   label: "Reports",   icon: BarChart3 },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname() || "/";
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-ink-100 md:bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-ink-100 px-5">
        <Logo />
      </div>

      <div className="space-y-3 px-4 pt-4">
        <BusinessSwitcher />
        <Link href="/invoices/new" className="btn-primary w-full">
          <Plus className="h-4 w-4" />
          New invoice
          <kbd className="ml-auto rounded bg-brand-700/40 px-1.5 py-0.5 text-[10px] font-semibold text-brand-50">
            N
          </kbd>
        </Link>
      </div>

      <nav className="mt-4 flex-1 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "my-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
              )}
            >
              <Icon className={clsx("h-4 w-4", active ? "text-brand-600" : "text-ink-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ink-100 p-4">
        <a
          href="https://github.com/Annex-Logistics/invoice-"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-800"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          About AnnexInvoice
        </a>
      </div>
    </aside>
  );
}
