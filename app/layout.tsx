import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";

// Render every page per request. `proxy.ts` sends a nonce-based CSP
// with a fresh nonce on each request, and Next.js can only stamp that
// nonce onto its <script> tags when the page is rendered at request
// time. Prerendered (static) pages ship scripts with no nonce, so the
// production CSP would block all of them and the app would never
// hydrate. The pages are thin client shells, so this costs little.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AnnexInvoice — Simple invoicing by Annex Logistics",
  description:
    "Create, send, and track professional invoices in minutes. Built by Annex Logistics.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts puts the request's CSP nonce here; the blocking theme script
  // needs it to be allowed by the strict production CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // theme-init.js may add `dark` before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets light/dark before first paint so there's no flash. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" nonce={nonce} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
