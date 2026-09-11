"use client";

import { useActionState } from "react";
import { useState } from "react";

export type RuleFormState = { error?: string } | undefined;

const TRIGGERS = [
  { value: "BEFORE_RENEWAL", label: "Before renewal (subscription ending)", usesOffset: true, offsetLabel: "Days before end" },
  { value: "ON_RENEWAL", label: "On renewal", usesOffset: false },
  { value: "AFTER_RENEWAL", label: "After renewal / expired", usesOffset: true, offsetLabel: "Days after end" },
  { value: "SUBSCRIPTION_EXPIRED", label: "Subscription expired", usesOffset: true, offsetLabel: "Days after expiry" },
  { value: "PAYMENT_DUE", label: "Invoice payment due", usesOffset: true, offsetLabel: "Days before due date" },
  { value: "PAYMENT_OVERDUE", label: "Invoice payment overdue", usesOffset: true, offsetLabel: "Days after due date" },
  { value: "INVOICE_CREATED", label: "Invoice created (event)", usesOffset: false },
  { value: "INVOICE_PAID", label: "Invoice paid (event)", usesOffset: false },
  { value: "CUSTOM", label: "Custom", usesOffset: false },
];

export default function RuleForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prev: RuleFormState, formData: FormData) => Promise<RuleFormState>;
  initial?: {
    name?: string;
    type?: string;
    triggerType?: string;
    daysOffset?: number;
    channels?: string[];
    subjectTemplate?: string | null;
    messageTemplate?: string;
    isActive?: boolean;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [trigger, setTrigger] = useState(initial?.triggerType ?? "BEFORE_RENEWAL");
  const triggerMeta = TRIGGERS.find((t) => t.value === trigger)!;

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div>
        <label className="label" htmlFor="name">Rule name *</label>
        <input id="name" name="name" required className="input" defaultValue={initial?.name} placeholder="e.g. 7-day renewal reminder" />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" className="input" defaultValue={initial?.type ?? "REMINDER"}>
            <option value="REMINDER">Reminder</option>
            <option value="ALERT">Alert</option>
            <option value="NOTIFICATION">Notification</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="triggerType">Trigger</label>
          <select
            id="triggerType"
            name="triggerType"
            className="input"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
          >
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {triggerMeta.usesOffset && (
        <div>
          <label className="label" htmlFor="daysOffset">{triggerMeta.offsetLabel}</label>
          <input id="daysOffset" name="daysOffset" type="number" className="input" defaultValue={initial?.daysOffset ?? 7} />
        </div>
      )}

      <div>
        <label className="label">Channels</label>
        <div className="flex flex-wrap gap-4">
          {["EMAIL", "SMS", "TELEGRAM"].map((ch) => (
            <label key={ch} className="flex items-center gap-2">
              <input
                type="checkbox"
                name="channels"
                value={ch}
                defaultChecked={initial?.channels?.includes(ch) ?? ch === "EMAIL"}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              <span className="text-sm">{ch.charAt(0) + ch.slice(1).toLowerCase()}</span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">Configure each channel in Settings.</p>
      </div>

      <div>
        <label className="label" htmlFor="subjectTemplate">Email subject (optional)</label>
        <input id="subjectTemplate" name="subjectTemplate" className="input" defaultValue={initial?.subjectTemplate ?? ""} placeholder="Your subscription renews soon" />
      </div>

      <div>
        <label className="label" htmlFor="messageTemplate">Message template *</label>
        <textarea
          id="messageTemplate"
          name="messageTemplate"
          required
          rows={5}
          className="input font-mono text-xs"
          defaultValue={initial?.messageTemplate ?? "Hi {{customerName}},\n\nYour {{planName}} subscription will renew on {{subscriptionEndDate}}.\n\n{{companyName}}"}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          Variables: {"{{customerName}} {{planName}} {{subscriptionEndDate}} {{daysLeft}} {{invoiceNumber}} {{invoiceTotal}} {{invoiceDueDate}} {{companyName}}"}
        </p>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} className="h-4 w-4 rounded border-[var(--border)]" />
        <span className="text-sm">Active</span>
      </label>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary">{submitLabel}</button>
        <a href="/alerts" className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
