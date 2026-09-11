import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import DeleteButton from "@/components/ui/delete-button";
import ToggleRule from "@/components/alerts/toggle-rule";
import { deleteRule } from "@/app/actions/alerts";
import { Bell, Plus, Pencil, Mail, MessageSquare, Send } from "lucide-react";
import { formatDate, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const [rules, logs] = await Promise.all([
    prisma.notificationRule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notificationLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  function channelIcon(ch: string) {
    if (ch === "EMAIL") return <Mail className="h-3 w-3" />;
    if (ch === "SMS") return <MessageSquare className="h-3 w-3" />;
    return <Send className="h-3 w-3" />;
  }

  return (
    <div>
      <PageHeader
        title="Alerts & Reminders"
        description="Automated notification rules and delivery logs."
        actions={
          <Link href="/alerts/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add rule
          </Link>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">Rules</h2>
        {rules.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title="No notification rules yet"
            description="Create rules to automatically remind customers about renewals, due invoices and more."
            action={
              <Link href="/alerts/new" className="btn-primary">
                <Plus className="h-4 w-4" /> Add rule
              </Link>
            }
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Trigger</th>
                  <th>Channels</th>
                  <th>Active</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td><span className="badge bg-indigo-50 text-indigo-700 border-indigo-200">{titleCase(r.type)}</span></td>
                    <td className="text-xs text-[var(--muted)]">
                      {titleCase(r.triggerType).replace(/_/g, " ")}
                      {r.daysOffset !== 0 && ` (${r.daysOffset}d)`}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {r.channels.map((ch) => (
                          <span key={ch} className="badge bg-gray-100 text-gray-600 border-gray-200" title={ch}>
                            {channelIcon(ch)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td><ToggleRule id={r.id} active={r.isActive} /></td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/alerts/${r.id}/edit`} className="btn-ghost" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <DeleteButton onDelete={deleteRule.bind(null, r.id)} confirmMessage={`Delete rule "${r.name}"?`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Recent delivery log</h2>
        {logs.length === 0 ? (
          <div className="card p-8 text-center text-sm text-[var(--muted)]">
            No notifications sent yet. Logs appear here once rules fire (via the cron job) or invoices are emailed.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Channel</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="text-[var(--muted)]">{formatDate(l.createdAt, true)}</td>
                    <td>
                      <span className="badge bg-gray-100 text-gray-600 border-gray-200">
                        {channelIcon(l.channel)} <span className="ml-1">{titleCase(l.channel)}</span>
                      </span>
                    </td>
                    <td className="text-xs">{l.recipient ?? "—"}</td>
                    <td>
                      <span className={`badge ${
                        l.status === "SENT" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        l.status === "FAILED" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        l.status === "SKIPPED" ? "bg-gray-100 text-gray-500 border-gray-200" :
                        "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>{titleCase(l.status)}</span>
                      {l.error && <p className="mt-0.5 text-xs text-rose-500">{l.error}</p>}
                    </td>
                    <td className="text-xs text-[var(--muted)]">{l.subject ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
