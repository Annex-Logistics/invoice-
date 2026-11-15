"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import type { Currency, LineItem } from "@/lib/types";
import { formatMoney } from "@/lib/currencies";
import { createId } from "@/lib/storage";

type Props = {
  items: LineItem[];
  currency: Currency;
  onChange: (items: LineItem[]) => void;
  // false for documents without prices (delivery notes): only the
  // description and quantity columns are shown. Rates are kept in the data.
  showPrices?: boolean;
};

export function LineItemsTable({ items, currency, onChange, showPrices = true }: Props) {
  const cols = showPrices
    ? "md:grid-cols-[2fr_80px_120px_120px_40px]"
    : "md:grid-cols-[2fr_100px_40px]";
  function patchItem(id: string, patch: Partial<LineItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    if (items.length === 1) {
      onChange([{ id: createId(), description: "", quantity: 1, rate: 0 }]);
      return;
    }
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem() {
    onChange([...items, { id: createId(), description: "", quantity: 1, rate: 0 }]);
  }

  return (
    <div className="card overflow-hidden">
      <div className={`hidden ${cols} gap-3 border-b border-ink-100 bg-ink-50/70 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-500 md:grid`}>
        <div>Description</div>
        <div className="text-right">Qty</div>
        {showPrices && <div className="text-right">Rate</div>}
        {showPrices && <div className="text-right">Amount</div>}
        <div />
      </div>

      <ul className="divide-y divide-ink-100">
        {items.map((item) => {
          const amount = (Number(item.quantity) || 0) * (Number(item.rate) || 0);
          return (
            <li
              key={item.id}
              className={`grid grid-cols-1 gap-2 px-4 py-3 ${cols} md:gap-3 md:py-2.5`}
            >
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2 hidden h-4 w-4 flex-none text-ink-300 md:block" />
                <input
                  value={item.description}
                  onChange={(e) => patchItem(item.id, { description: e.target.value })}
                  placeholder="Item description"
                  aria-label="Item description"
                  maxLength={500}
                  className="field-ghost min-h-[36px]"
                />
              </div>
              <div className="flex items-center gap-2 md:justify-end">
                <span className="text-xs text-ink-500 md:hidden">Qty</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={item.quantity}
                  aria-label="Quantity"
                  onChange={(e) => patchItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                  className="field-ghost text-right md:w-20"
                />
              </div>
              {showPrices && (
              <div className="flex items-center gap-2 md:justify-end">
                <span className="text-xs text-ink-500 md:hidden">Rate</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={item.rate}
                  aria-label="Rate"
                  onChange={(e) => patchItem(item.id, { rate: parseFloat(e.target.value) || 0 })}
                  className="field-ghost text-right md:w-28"
                />
              </div>
              )}
              {showPrices && (
              <div className="flex items-center justify-between gap-2 text-sm font-medium text-ink-900 md:justify-end">
                <span className="text-xs text-ink-500 md:hidden">Amount</span>
                <span>{formatMoney(amount, currency)}</span>
              </div>
              )}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-ink-100 p-3">
        <button type="button" onClick={addItem} className="btn-ghost w-full justify-center">
          <Plus className="h-4 w-4" />
          Add line item
        </button>
      </div>
    </div>
  );
}
