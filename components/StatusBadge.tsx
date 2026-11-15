import clsx from "clsx";
import type { DocumentStatus } from "@/lib/types";

const styles: Record<DocumentStatus, string> = {
  draft:    "bg-ink-100 text-ink-700",
  sent:     "bg-blue-50 text-blue-700",
  paid:     "bg-emerald-50 text-emerald-700",
  overdue:  "bg-rose-50 text-rose-700",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-rose-50 text-rose-700",
  issued:    "bg-emerald-50 text-emerald-700",
  delivered: "bg-emerald-50 text-emerald-700",
};

const labels: Record<DocumentStatus, string> = {
  draft:    "Draft",
  sent:     "Sent",
  paid:     "Paid",
  overdue:  "Overdue",
  accepted: "Accepted",
  declined: "Declined",
  issued:    "Issued",
  delivered: "Delivered",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={clsx("chip", styles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labels[status]}
    </span>
  );
}
