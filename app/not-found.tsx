import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 text-center">
      <Logo />
      <div className="mt-8 text-7xl font-extrabold text-brand-600">404</div>
      <h1 className="mt-2 text-2xl font-bold text-ink-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500">
        That page doesn&apos;t exist — the invoice may have been deleted or the link is wrong.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/" className="btn-primary">Back to dashboard</Link>
        <Link href="/invoices/new" className="btn-secondary">Create invoice</Link>
      </div>
    </div>
  );
}
