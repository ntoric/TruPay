"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Check, KeyRound, Trash2, Ban } from "lucide-react";
import type { ApiKey } from "@prisma/client";
import { createApiKey, revokeApiKey, deleteApiKey } from "@/app/actions/api-keys";
import { formatDate } from "@/lib/utils";

type State = { error?: string; key?: string; id?: string } | undefined;

export default function ApiKeysSection({ keys }: { keys: ApiKey[] }) {
  const [state, formAction] = useActionState<State, FormData>(createApiKey, undefined);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  const showNewKey = state?.key && !dismissed;

  async function copyKey() {
    if (!state?.key) return;
    await navigator.clipboard.writeText(state.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[var(--primary)]" />
        <h2 className="text-base font-semibold">API Keys</h2>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Generate API keys to let external systems read your data via the public REST API at{" "}
        <code className="rounded bg-[var(--accent)] px-1 py-0.5 text-xs">/api/v1/*</code>.
        Authenticate requests with{" "}
        <code className="rounded bg-[var(--accent)] px-1 py-0.5 text-xs">Authorization: Bearer shub_...</code>.
        Keys are shown in full only once — store them securely.
      </p>

      {/* New key reveal */}
      {showNewKey && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800">
              New API key created — copy it now, it won&apos;t be shown again.
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
              {state.key}
            </code>
            <button type="button" onClick={copyKey} className="btn-secondary px-3 py-2">
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
      <form action={formAction} className="mb-5 flex items-end gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="apiKeyName">Name</label>
          <input
            id="apiKeyName"
            name="name"
            className="input"
            placeholder="e.g. Zapier integration"
            maxLength={80}
          />
        </div>
        <button type="submit" className="btn-primary">Generate key</button>
      </form>

      {/* Existing keys */}
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Last used</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[var(--muted)]">
                  No API keys yet.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id}>
                <td className="font-medium">{k.name}</td>
                <td>
                  <code className="text-xs">{k.prefix}…</code>
                </td>
                <td className="text-xs text-[var(--muted)]">
                  {k.lastUsedAt ? formatDate(k.lastUsedAt, true) : "Never"}
                </td>
                <td>
                  {k.isActive ? (
                    <span className="badge border-emerald-200 bg-emerald-100 text-emerald-700">Active</span>
                  ) : (
                    <span className="badge border-gray-300 bg-gray-200 text-gray-600">Revoked</span>
                  )}
                </td>
                <td className="text-xs text-[var(--muted)]">{formatDate(k.createdAt)}</td>
                <td>
                  <div className="flex items-center gap-1">
                    {k.isActive && (
                      <button
                        title="Revoke"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm("Revoke this API key? It will stop working immediately.")) return;
                          startTransition(async () => {
                            await revokeApiKey(k.id);
                          });
                        }}
                        className="btn-ghost px-2 py-1 text-amber-600 hover:bg-amber-50"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      title="Delete"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("Permanently delete this API key?")) return;
                        startTransition(async () => {
                          await deleteApiKey(k.id);
                        });
                      }}
                      className="btn-ghost px-2 py-1 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
