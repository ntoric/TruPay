"use client";

import { useSearchParams } from "next/navigation";

type ProductOption = { id: string; name: string };

const STATUSES = ["ACTIVE", "TRIALING", "PENDING", "PAST_DUE", "EXPIRED", "CANCELLED"];

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function SubscriptionFilters({
  products,
  productFilter,
  statusFilter,
}: {
  products: ProductOption[];
  productFilter?: string;
  statusFilter?: string;
}) {
  const searchParams = useSearchParams();

  function onChange(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    window.location.href = `/subscriptions?${params.toString()}`;
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <select
          className="input w-auto min-w-[160px]"
          value={productFilter ?? ""}
          onChange={(e) => onChange("product", e.target.value)}
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <select
        className="input w-auto min-w-[140px]"
        value={statusFilter ?? ""}
        onChange={(e) => onChange("status", e.target.value)}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{titleCase(s)}</option>
        ))}
      </select>
      {(productFilter || statusFilter) && (
        <a href="/subscriptions" className="btn-secondary text-xs">Clear filters</a>
      )}
    </div>
  );
}
