"use client";

import { useActionState } from "react";
import { useTransition } from "react";

export default function PaymentForm({
  action,
  remaining,
  currency,
}: {
  action: (prev: { error?: string } | undefined, formData: FormData) => Promise<{ error?: string } | undefined>;
  remaining: number;
  currency: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [, startTransition] = useTransition();

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {state.error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className="input" defaultValue={remaining.toFixed(2)} />
        </div>
        <div>
          <label className="label" htmlFor="method">Method</label>
          <select id="method" name="method" className="input" defaultValue="CARD">
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="ONLINE">Online</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="transactionId">Transaction ID</label>
          <input id="transactionId" name="transactionId" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="notes">Notes</label>
          <input id="notes" name="notes" className="input" />
        </div>
      </div>
      <button
        type="submit"
        onClick={() => startTransition(() => {})}
        className="btn-primary text-sm"
      >
        Record payment
      </button>
    </form>
  );
}
