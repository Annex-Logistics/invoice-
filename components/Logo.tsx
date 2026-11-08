import clsx from "clsx";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
        <svg viewBox="0 0 32 32" className="h-5 w-5 text-white" fill="currentColor" aria-hidden="true">
          <path d="M8 6h14a4 4 0 0 1 4 4v16l-3-2-2 2-2-2-2 2-2-2-2 2-3-2V10a4 4 0 0 1 4-4z" opacity=".95" />
          <rect x="11" y="12" width="12" height="1.6" rx=".8" fill="#1866ea"/>
          <rect x="11" y="16" width="9"  height="1.6" rx=".8" fill="#2f85ff"/>
          <rect x="11" y="20" width="6"  height="1.6" rx=".8" fill="#8ec5ff"/>
        </svg>
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-bold text-ink-900">AnnexInvoice</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
            by Annex Logistics
          </div>
        </div>
      )}
    </div>
  );
}
