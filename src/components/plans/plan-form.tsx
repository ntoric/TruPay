"use client";

import { useActionState } from "react";
import { useState } from "react";

export type PlanFormState = { error?: string } | undefined;

export type PlanInitial = {
  name?: string;
  description?: string | null;
  price?: string | number;
  billingCycle?: string;
  durationDays?: number;
  features?: string[] | null;
  isActive?: boolean;
};

const CYCLES = ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"];

export default function PlanForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  initial?: PlanInitial;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [cycle, setCycle] = useState(initial?.billingCycle ?? "MONTHLY");

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="name">Plan name *</label>
        <input id="name" name="name" required className="input" defaultValue={initial?.name} placeholder="e.g. Pro Monthly" />
      </div>

      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={2} className="input" defaultValue={initial?.description ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="price">Price *</label>
          <input id="price" name="price" type="number" step="0.01" min="0" required className="input" defaultValue={initial?.price ?? "0"} />
        </div>
        <div>
          <label className="label" htmlFor="billingCycle">Billing cycle *</label>
          <select
            id="billingCycle"
            name="billingCycle"
            className="input"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
          >
            {CYCLES.map((c) => (
              <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {cycle === "CUSTOM" && (
        <div>
          <label className="label" htmlFor="durationDays">Duration (days)</label>
          <input
            id="durationDays"
            name="durationDays"
            type="number"
            min="1"
            className="input"
            defaultValue={initial?.durationDays ?? 30}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">Custom billing period length in days.</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="features">Features (one per line)</label>
        <textarea
          id="features"
          name="features"
          rows={4}
          className="input"
          defaultValue={initial?.features ? initial.features.join("\n") : ""}
          placeholder={"Up to 10 users\nPriority support\nCustom reports"}
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="h-4 w-4 rounded border-[var(--border)]"
        />
        <span className="text-sm">Active (available for new subscriptions)</span>
      </label>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/plans" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
