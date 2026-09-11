import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import { Pencil, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate, daysUntil, statusColor, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({
  params,
}: PageProps<"/subscriptions/[id]">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const sub = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    include: {
      customer: true,
      plan: true,
      product: true,
      invoices: { orderBy: { createdAt: "desc" }, include: { _count: { select: { payments: true } } } },
    },
  });
  if (!sub) notFound();

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = settings?.currency ?? "INR";
  const dleft = daysUntil(sub.endDate);

  return (
    <div>
      <Link href="/subscriptions" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Back to subscriptions
      </Link>
      <PageHeader
        title={sub.customer.name}
        description={`${sub.plan.name} subscription`}
        actions={
          <Link href={`/subscriptions/${sub.id}/edit`} className="btn-secondary">
            <Pencil className="h-4 w-4" /> Edit
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-4 text-base font-semibold">Details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Status</dt>
              <dd><span className={`badge ${statusColor(sub.status)}`}>{titleCase(sub.status)}</span></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Plan</dt>
              <dd className="font-medium">{sub.plan.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Product</dt>
              <dd className="font-medium">
                {sub.product ? (
                  <Link
                    href={`/subscriptions?product=${sub.product.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {sub.product.name}
                  </Link>
                ) : (
                  <span className="text-[var(--muted)]">—</span>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Price</dt>
              <dd className="font-medium">{formatCurrency(sub.price, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Billing</dt>
              <dd>{titleCase(sub.plan.billingCycle)} · {sub.plan.durationDays}d</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Starts</dt>
              <dd>{formatDate(sub.startDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Ends</dt>
              <dd className={dleft < 0 ? "text-rose-600 font-medium" : dleft < 7 ? "text-amber-600 font-medium" : ""}>
                {formatDate(sub.endDate)} ({dleft < 0 ? `${Math.abs(dleft)}d ago` : `in ${dleft}d`})
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--muted)]">Auto-renew</dt>
              <dd>{sub.autoRenew ? "Yes" : "No"}</dd>
            </div>
            {sub.notes && (
              <div>
                <dt className="text-[var(--muted)]">Notes</dt>
                <dd className="mt-1">{sub.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold">Invoices</h2>
            <Link href={`/invoices/new?subscription=${sub.id}&customer=${sub.customerId}`} className="btn-primary text-xs">
              New invoice
            </Link>
          </div>
          {sub.invoices.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">No invoices for this subscription.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {sub.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="text-[var(--muted)]">{formatDate(inv.issueDate)}</td>
                    <td className="text-[var(--muted)]">{formatDate(inv.dueDate)}</td>
                    <td><span className={`badge ${statusColor(inv.status)}`}>{titleCase(inv.status)}</span></td>
                    <td className="font-medium">{formatCurrency(inv.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
