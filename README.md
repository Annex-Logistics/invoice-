# AnnexInvoice

A clean, modern invoice builder by **Annex Logistics**.

Create, preview, and download professional PDF invoices in minutes — all in your browser. No signup, no server, no tracking: every invoice is stored locally so your data stays on your device.

## Features

- Dashboard with totals, collected, outstanding and overdue at-a-glance
- Full invoice editor:
  - Business branding (name, logo, address, email, phone, website)
  - Bill-to and optional ship-to parties
  - Line items with quantity, rate, and auto-calculated amount
  - Percent or fixed discount, percent or fixed tax, shipping
  - Amount paid and balance due
  - Notes and terms
- 15 built-in currencies
- Clean PDF export (via jsPDF)
- Printable preview that matches the PDF
- Invoice list with filters (draft / sent / paid / overdue) and search
- Auto-generated clients view compiled from your invoices
- Export / import a JSON backup of all your data
- Auto-save as you type
- Responsive — works on mobile with a bottom nav bar

## Tech

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [lucide-react](https://lucide.dev/) icons
- [jsPDF](https://github.com/parallax/jsPDF) for PDF export
- `localStorage` for persistence

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3100.

## Build for production

```bash
npm run build
npm start
```

## Deploy

AnnexInvoice is a plain Next.js app, so it deploys anywhere Next.js runs — Vercel, Netlify, Cloudflare Pages, a VPS, or a container.

Example (Vercel):

```bash
npx vercel
```

## Data & privacy

Everything is saved in your browser's `localStorage` under the `annexinvoice.*` keys. Clearing site data erases all invoices, so use **Settings → Export backup** regularly if the invoices matter to you.

## License

MIT © Annex Logistics
