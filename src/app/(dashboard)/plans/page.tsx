import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import DeleteButton from "@/components/ui/delete-button";
import { deletePlan } from "@/app/actions/plans";
import { Layers, Plus, Pencil } from "lucide-react";
import { formatCurrency, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = settings?.currency ?? "INR";

  const plans = await prisma.plan.findMany({
    where: { userId: user.id },
    orderBy: [{ isCustom: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Define predefined plans and custom billing plans for your subscriptions."
        actions={
          <Link href="/plans/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add plan
          </Link>
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title="No plans yet"
          description="Create predefined plans (e.g. Monthly, Yearly) or custom plans with a custom duration."
          action={
            <Link href="/plans/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Add plan
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className={`badge mt-1 ${p.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {p.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                {p.isCustom && (
                  <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200">Custom</span>
                )}
              </div>

              {p.description && (
                <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">{p.description}</p>
              )}

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold">{formatCurrency(p.price, currency)}</span>
                <span className="text-sm text-[var(--muted)]">/ {titleCase(p.billingCycle).toLowerCase()}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">{p.durationDays} day cycle</p>

              {p.features && Array.isArray(p.features) && (p.features as string[]).length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {(p.features as string[]).slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-[var(--muted)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> {f}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                <span className="text-xs text-[var(--muted)]">{p._count.subscriptions} subscription(s)</span>
                <div className="flex gap-1">
                  <Link href={`/plans/${p.id}/edit`} className="btn-ghost" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <DeleteButton
                    onDelete={deletePlan.bind(null, p.id)}
                    confirmMessage={`Delete plan "${p.name}"?`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
