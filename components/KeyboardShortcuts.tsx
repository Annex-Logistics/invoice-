"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (typing) return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/invoices/new");
        return;
      }

      if (!mod) {
        if (e.key === "g") {
          const next = (ev: KeyboardEvent) => {
            if (ev.key === "d") router.push("/");
            if (ev.key === "i") router.push("/invoices");
            if (ev.key === "e") router.push("/estimates");
            if (ev.key === "c") router.push("/clients");
            if (ev.key === "r") router.push("/reports");
            if (ev.key === "s") router.push("/settings");
            window.removeEventListener("keydown", next);
          };
          window.addEventListener("keydown", next);
          setTimeout(() => window.removeEventListener("keydown", next), 1200);
        }
        if (e.key === "n" && !e.shiftKey) {
          e.preventDefault();
          router.push("/invoices/new");
        }
        if (e.key === "N" && e.shiftKey) {
          e.preventDefault();
          router.push("/estimates/new");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
