"use client";

import { useActionState, useState, useTransition } from "react";
import { Webhook, Trash2, Copy, Check, RotateCw, Power, ChevronDown, ChevronRight } from "lucide-react";
import type { WebhookEndpoint, WebhookDelivery } from "@prisma/client";
import {
  createWebhook,
  deleteWebhook,
  toggleWebhook,
  retryWebhookDelivery,
  WEBHOOK_EVENTS,
} from "@/app/actions/webhooks";
import { formatDate } from "@/lib/utils";

type EndpointWithDeliveries = WebhookEndpoint & {
  deliveries: WebhookDelivery[];
};

type State = { error?: string; secret?: string; id?: string } | undefined;

export default function WebhooksSection({ endpoints }: { endpoints: EndpointWithDeliveries[] }) {
  const [state, formAction] = useActionState<State, FormData>(createWebhook, undefined);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();

  const showNewSecret = state?.secret && !dismissed;

  async function copySecret() {
    if (!state?.secret) return;
    await navigator.clipboard.writeText(state.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Webhook className="h-5 w-5 text-[var(--primary)]" />
        <h2 className="text-base font-semibold">Webhooks</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Register endpoints to receive signed event payloads (e.g. when a subscription is created or an
        invoice is paid). Each delivery is signed with{" "}
        <code className="rounded bg-[var(--accent)] px-1 py-0.5 text-xs">x-subhub-signature</code>{" "}
        (HMAC-SHA256 of the raw JSON body using the endpoint secret). Leave events blank to subscribe to all.
      </p>

      {/* New secret reveal */}
      {showNewSecret && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800">
              Webhook created — copy your signing secret now, it won&apos;t be shown again.
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs text-emerald-700 underline"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-3 py-2 text-xs text-emerald-900">
              {state.secret}
            </code>
            <button type="button" onClick={copySecret} className="btn-secondary px-3 py-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {state?.error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {/* Create form */}
      <form action={formAction} className="mb-5 space-y-3">
        <div>
          <label className="label" htmlFor="whUrl">Endpoint URL</label>
          <input id="whUrl" name="url" className="input" placeholder="https://your-app.com/webhooks/subhub" />
        </div>
        <div>
          <label className="label" htmlFor="whEvents">
            Events <span className="font-normal text-[var(--muted)]">(comma-separated, blank = all)</span>
          </label>
          <input
            id="whEvents"
            name="events"
            className="input"
            placeholder="e.g. invoice.paid, subscription.created"
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Available: {WEBHOOK_EVENTS.join(", ")}
          </p>
        </div>
        <button type="submit" className="btn-primary">Add endpoint</button>
      </form>

      {/* Existing endpoints */}
      <div className="space-y-3">
        {endpoints.length === 0 && (
          <p className="py-4 text-center text-sm text-[var(--muted)]">No webhook endpoints yet.</p>
        )}
        {endpoints.map((ep) => {
          const isOpen = expanded[ep.id] ?? false;
          return (
            <div key={ep.id} className="rounded-lg border border-[var(--border)]">
              <div className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpanded((s) => ({ ...s, [ep.id]: !isOpen }))}
                      className="btn-ghost px-1 py-1"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="truncate text-sm font-medium">{ep.url}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-8">
                    {ep.isActive ? (
                      <span className="badge border-emerald-200 bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge border-gray-300 bg-gray-200 text-gray-600">Disabled</span>
                    )}
                    {ep.events.length === 0 ? (
                      <span className="badge border-sky-200 bg-sky-100 text-sky-700">All events</span>
                    ) : (
                      ep.events.slice(0, 3).map((e) => (
                        <span key={e} className="badge border-[var(--border)] bg-[var(--accent)] text-[var(--muted)]">
                          {e}
                        </span>
                      ))
                    )}
                    {ep.events.length > 3 && (
                      <span className="text-xs text-[var(--muted)]">+{ep.events.length - 3} more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    title={ep.isActive ? "Disable" : "Enable"}
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        await toggleWebhook(ep.id);
                      });
                    }}
                    className="btn-ghost px-2 py-1"
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    title="Delete"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Delete this webhook endpoint and all its delivery logs?")) return;
                      startTransition(async () => {
                        await deleteWebhook(ep.id);
                      });
                    }}
                    className="btn-ghost px-2 py-1 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-[var(--border)] p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Recent deliveries
                  </h4>
                  {ep.deliveries.length === 0 ? (
                    <p className="text-xs text-[var(--muted)]">No deliveries yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {ep.deliveries.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between gap-2 rounded bg-[var(--accent)] px-3 py-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <code className="font-medium">{d.event}</code>
                              {d.status === "SUCCESS" && (
                                <span className="badge border-emerald-200 bg-emerald-100 text-emerald-700">
                                  {d.statusCode ?? "OK"}
                                </span>
                              )}
                              {d.status === "FAILED" && (
                                <span className="badge border-rose-200 bg-rose-100 text-rose-700">
                                  {d.statusCode ?? "ERR"}
                                </span>
                              )}
                              {d.status === "PENDING" && (
                                <span className="badge border-amber-200 bg-amber-100 text-amber-700">
                                  Pending
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-[var(--muted)]">
                              {formatDate(d.createdAt, true)}
                              {d.error ? ` — ${d.error}` : ""}
                            </div>
                          </div>
                          <button
                            title="Retry delivery"
                            disabled={pending}
                            onClick={() => {
                              startTransition(async () => {
                                await retryWebhookDelivery(d.id);
                              });
                            }}
                            className="btn-ghost px-2 py-1"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
