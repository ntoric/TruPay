"use client";

import { useActionState } from "react";
import { useState, useMemo } from "react";

export type SubFormState = { error?: string } | undefined;

type PlanOption = { id: string; name: string; price: string; billingCycle: string; durationDays: number };
type CustomerOption = { id: string; name: string };
type ProductOption = { id: string; name: string; sku?: string | null; category?: string | null };

const STATUSES = ["ACTIVE", "TRIALING", "PENDING", "PAST_DUE", "EXPIRED", "CANCELLED"];

export default function SubscriptionForm({
  action,
  customers,
  plans,
  products = [],
  initial,
  submitLabel,
  showInvoiceOption,
}: {
  action: (prev: SubFormState, formData: FormData) => Promise<SubFormState>;
  customers: CustomerOption[];
  plans: PlanOption[];
  products?: ProductOption[];
  initial?: {
    customerId?: string;
    planId?: string;
    productId?: string | null;
    status?: string;
    startDate?: string;
    price?: string | number;
    autoRenew?: boolean;
    notes?: string | null;
  };
  submitLabel: string;
  showInvoiceOption?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [planId, setPlanId] = useState(initial?.planId ?? plans[0]?.id ?? "");

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === planId),
    [plans, planId],
  );

  const today = new Date().toISOString().slice(0, 10);
  const initialDate = initial?.startDate
    ? new Date(initial.startDate).toISOString().slice(0, 10)
    : today;

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerId">Customer *</label>
          <select id="customerId" name="customerId" required className="input" defaultValue={initial?.customerId}>
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="planId">Plan *</label>
          <select
            id="planId"
            name="planId"
            required
            className="input"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          >
            <option value="">Select plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — ${p.price} / {p.billingCycle}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="productId">Product</label>
        <select id="productId" name="productId" className="input" defaultValue={initial?.productId ?? ""}>
          <option value="">None</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.sku ? ` (${p.sku})` : ""}{p.category ? ` — ${p.category}` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Link a product to this subscription.{" "}
          {products.length === 0 && (
            <a href="/products/new" className="text-indigo-600 hover:underline">Create a product first</a>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="startDate">Start date *</label>
          <input id="startDate" name="startDate" type="date" required className="input" defaultValue={initialDate} />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="input" defaultValue={initial?.status ?? "ACTIVE"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="price">Price override</label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder={selectedPlan ? `$${selectedPlan.price}` : "0.00"}
            defaultValue={initial?.price ?? ""}
          />
        </div>
      </div>

      {selectedPlan && (
        <p className="text-xs text-[var(--muted)]">
          Plan duration: {selectedPlan.durationDays} days. Leave price blank to use the plan price.
        </p>
      )}

      <div>
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} className="input" defaultValue={initial?.notes ?? ""} />
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="autoRenew"
            defaultChecked={initial?.autoRenew ?? false}
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          <span className="text-sm">Auto-renew at end of cycle</span>
        </label>

        {showInvoiceOption && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="createInvoice"
              defaultChecked
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            <span className="text-sm">Generate first invoice now</span>
          </label>
        )}
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/subscriptions" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
