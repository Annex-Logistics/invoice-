"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, FileCheck, FileText, LayoutDashboard, Plus, Settings } from "lucide-react";
import { Logo } from "./Logo";
import { BusinessSwitcher } from "./BusinessSwitcher";

const items = [
  { href: "/",          label: "Home",      icon: LayoutDashboard },
  { href: "/invoices",  label: "Invoices",  icon: FileText },
  { href: "/estimates", label: "Estimates", icon: FileCheck },
  { href: "/reports",   label: "Reports",   icon: BarChart3 },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname() || "/";
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
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-ink-100 bg-white px-2 py-1 md:hidden">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-medium",
                active ? "text-brand-700" : "text-ink-500"
              )}
            >
              <Icon className={clsx("h-5 w-5", active ? "text-brand-600" : "text-ink-400")} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
