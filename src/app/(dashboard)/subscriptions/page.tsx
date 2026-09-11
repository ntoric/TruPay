import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import DeleteButton from "@/components/ui/delete-button";
import RenewButton from "@/components/subscriptions/renew-button";
import SubscriptionFilters from "@/components/subscriptions/subscription-filters";
import { deleteSubscription } from "@/app/actions/subscriptions";
import { CreditCard, Plus, Pencil } from "lucide-react";
import { formatCurrency, formatDate, daysUntil, statusColor, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SubscriptionsPage({
  searchParams,
}: PageProps<"/subscriptions">) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = settings?.currency ?? "INR";

  // Build filter from query params
  const productFilter = typeof sp.product === "string" ? sp.product : undefined;
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;

  const where: Record<string, unknown> = { userId: user.id };
  if (productFilter) where.productId = productFilter;
  if (statusFilter) where.status = statusFilter;

  const [subs, products] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { customer: true, plan: true, product: true },
    }),
    prisma.product.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Manage customer subscriptions and memberships."
        actions={
          <Link href="/subscriptions/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add subscription
          </Link>
        }
      />

      {/* Filters */}
      {products.length > 0 && (
        <SubscriptionFilters
          products={products}
          productFilter={productFilter}
          statusFilter={statusFilter}
        />
      )}

      {subs.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-10 w-10" />}
          title={productFilter || statusFilter ? "No matching subscriptions" : "No subscriptions yet"}
          description={
            productFilter || statusFilter
              ? "Try adjusting your filters."
              : "Create a subscription by linking a customer to a plan."
          }
          action={
            productFilter || statusFilter ? undefined : (
              <Link href="/subscriptions/new" className="btn-primary">
                <Plus className="h-4 w-4" /> Add subscription
              </Link>
            )
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Starts</th>
                  <th>Ends</th>
                  <th>Price</th>
                  <th>Auto-renew</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => {
                  const dleft = daysUntil(s.endDate);
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">
                        <Link href={`/subscriptions/${s.id}`} className="hover:underline">
                          {s.customer.name}
                        </Link>
                      </td>
                      <td>
                        {s.product ? (
                          <Link
                            href={`/subscriptions?product=${s.product.id}`}
                            className="badge bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                            title={s.product.sku ?? undefined}
                          >
                            {s.product.name}
                          </Link>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td>{s.plan.name}</td>
                      <td>
                        <span className={`badge ${statusColor(s.status)}`}>{titleCase(s.status)}</span>
                      </td>
                      <td className="text-[var(--muted)]">{formatDate(s.startDate)}</td>
                      <td>
                        <span className={dleft < 0 ? "text-rose-600" : dleft < 7 ? "text-amber-600" : ""}>
                          {formatDate(s.endDate)}
                          <span className="ml-1 text-xs text-[var(--muted)]">
                            ({dleft < 0 ? `${Math.abs(dleft)}d ago` : `in ${dleft}d`})
                          </span>
                        </span>
                      </td>
                      <td className="font-medium">{formatCurrency(s.price, currency)}</td>
                      <td>
                        {s.autoRenew ? (
                          <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">On</span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <RenewButton id={s.id} />
                          <Link href={`/subscriptions/${s.id}/edit`} className="btn-ghost" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <DeleteButton
                            onDelete={deleteSubscription.bind(null, s.id)}
                            confirmMessage={`Delete subscription for ${s.customer.name}?`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
