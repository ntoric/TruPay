"use client";

import { useActionState } from "react";
import { type ReactNode } from "react";

export type CustomerFormState = { error?: string } | undefined;

export type CustomerInitial = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  telegramChatId?: string | null;
  company?: string | null;
  address?: string | null;
  notes?: string | null;
};

export default function CustomerForm({
  action,
  initial,
  submitLabel,
  errorSlot,
}: {
  action: (prev: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  initial?: CustomerInitial;
  submitLabel: string;
  errorSlot?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {errorSlot}
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="name">Full name *</label>
          <input id="name" name="name" required className="input" defaultValue={initial?.name} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" defaultValue={initial?.email ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className="input" defaultValue={initial?.phone ?? ""} placeholder="+1 555 000 0000" />
        </div>
        <div>
          <label className="label" htmlFor="company">Company</label>
          <input id="company" name="company" className="input" defaultValue={initial?.company ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="telegramChatId">Telegram Chat ID</label>
          <input id="telegramChatId" name="telegramChatId" className="input" defaultValue={initial?.telegramChatId ?? ""} placeholder="e.g. 123456789" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="address">Address</label>
          <input id="address" name="address" className="input" defaultValue={initial?.address ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} className="input" defaultValue={initial?.notes ?? ""} />
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/customers" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
