"use client";

import { useActionState } from "react";

export type ProductFormState = { error?: string } | undefined;

export default function ProductForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  initial?: {
    name?: string;
    description?: string | null;
    sku?: string | null;
    category?: string | null;
    price?: string | number;
    isActive?: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="name">Product name *</label>
        <input id="name" name="name" required className="input" defaultValue={initial?.name} placeholder="e.g. Premium VPN Access" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="sku">SKU / Code</label>
          <input id="sku" name="sku" className="input" defaultValue={initial?.sku ?? ""} placeholder="VPN-PREMIUM" />
        </div>
        <div>
          <label className="label" htmlFor="category">Category</label>
          <input id="category" name="category" className="input" defaultValue={initial?.category ?? ""} placeholder="Software" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="price">Default price</label>
        <input id="price" name="price" type="number" step="0.01" min="0" className="input" defaultValue={initial?.price ?? "0"} />
        <p className="mt-1 text-xs text-[var(--muted)]">Used as a reference. The subscription price can override this.</p>
      </div>

      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={3} className="input" defaultValue={initial?.description ?? ""} />
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4 rounded border-[var(--border)]" />
        <span className="text-sm">Active (available for new subscriptions)</span>
      </label>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/products" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
