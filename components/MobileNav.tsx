"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { FileText, LayoutDashboard, Plus, Settings, Users } from "lucide-react";
import { Logo } from "./Logo";

const items = [
  { href: "/",         label: "Home",     icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/clients",  label: "Clients",  icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname() || "/";
  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-ink-100 bg-white px-4 md:hidden">
        <Logo />
        <Link href="/invoices/new" className="btn-primary !px-3 !py-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          New
        </Link>
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
