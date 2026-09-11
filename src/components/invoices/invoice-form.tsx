"use client";

import { useActionState } from "react";
import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";

export type InvoiceFormState = { error?: string } | undefined;

type CustomerOption = { id: string; name: string };
type SubscriptionOption = { id: string; label: string };
type ItemRow = { description: string; quantity: string; unitPrice: string };

export default function InvoiceForm({
  action,
  customers,
  subscriptions = [],
  initial,
  submitLabel,
  defaultCustomerId,
  defaultSubscriptionId,
}: {
  action: (prev: InvoiceFormState, formData: FormData) => Promise<InvoiceFormState>;
  customers: CustomerOption[];
  subscriptions?: SubscriptionOption[];
  initial?: {
    customerId?: string;
    subscriptionId?: string | null;
    issueDate?: string;
    dueDate?: string;
    status?: string;
    taxRate?: string | number;
    discount?: string | number;
    notes?: string | null;
    items?: ItemRow[];
  };
  submitLabel: string;
  defaultCustomerId?: string;
  defaultSubscriptionId?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const [items, setItems] = useState<ItemRow[]>(
    initial?.items && initial.items.length > 0
      ? initial.items
      : [{ description: "", quantity: "1", unitPrice: "0" }],
  );

  const [taxRate, setTaxRate] = useState(String(initial?.taxRate ?? "0"));
  const [discount, setDiscount] = useState(String(initial?.discount ?? "0"));

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (s, it) => s + (parseFloat(it.quantity || "0") * parseFloat(it.unitPrice || "0")),
      0,
    );
    const tax = subtotal * (parseFloat(taxRate || "0") / 100);
    const total = Math.max(0, subtotal + tax - (parseFloat(discount || "0")));
    return { subtotal, tax, total };
  }, [items, taxRate, discount]);

  function updateItem(i: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "0" }]);
  }
  function removeItem(i: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerId">Customer *</label>
          <select
            id="customerId"
            name="customerId"
            required
            className="input"
            defaultValue={initial?.customerId ?? defaultCustomerId}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="subscriptionId">Linked subscription</label>
          <select
            id="subscriptionId"
            name="subscriptionId"
            className="input"
            defaultValue={initial?.subscriptionId ?? defaultSubscriptionId ?? ""}
          >
            <option value="">None</option>
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="issueDate">Issue date *</label>
          <input id="issueDate" name="issueDate" type="date" required className="input" defaultValue={initial?.issueDate?.slice(0, 10) ?? today} />
        </div>
        <div>
          <label className="label" htmlFor="dueDate">Due date *</label>
          <input id="dueDate" name="dueDate" type="date" required className="input" defaultValue={initial?.dueDate?.slice(0, 10) ?? in7} />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" defaultValue={initial?.status ?? "DRAFT"}>
            {["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"].map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Line items */}
      <div className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold">Line items</h3>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
              <input
                className="input col-span-12 sm:col-span-5"
                placeholder="Description"
                value={it.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
              />
              <input
                className="input col-span-4 sm:col-span-2"
                type="number"
                step="0.01"
                min="0"
                placeholder="Qty"
                value={it.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
              />
              <input
                className="input col-span-4 sm:col-span-2"
                type="number"
                step="0.01"
                min="0"
                placeholder="Unit price"
                value={it.unitPrice}
                onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
              />
              <span className="col-span-3 sm:col-span-2 text-right text-sm font-medium">
                ${(parseFloat(it.quantity || "0") * parseFloat(it.unitPrice || "0")).toFixed(2)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="col-span-1 flex justify-end text-[var(--muted)] hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border)] px-4 py-3">
          <button type="button" onClick={addItem} className="btn-secondary text-xs">
            <Plus className="h-3 w-3" /> Add line item
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="taxRate">Tax rate (%)</label>
          <input id="taxRate" name="taxRate" type="number" step="0.01" min="0" className="input" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="discount">Discount</label>
          <input id="discount" name="discount" type="number" step="0.01" min="0" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="card flex flex-col justify-center p-4">
          <div className="flex justify-between text-sm"><span className="text-[var(--muted)]">Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-[var(--muted)]">Tax</span><span>${totals.tax.toFixed(2)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-[var(--muted)]">Discount</span><span>-${parseFloat(discount || "0").toFixed(2)}</span></div>
          <div className="mt-1 flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} className="input" defaultValue={initial?.notes ?? ""} />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/invoices" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
