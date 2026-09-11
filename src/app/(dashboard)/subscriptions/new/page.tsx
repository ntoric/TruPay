import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import SubscriptionForm from "@/components/subscriptions/subscription-form";
import { createSubscription } from "@/app/actions/subscriptions";

export const dynamic = "force-dynamic";

export default async function NewSubscriptionPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const [customers, plans, products] = await Promise.all([
    prisma.customer.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.plan.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, billingCycle: true, durationDays: true },
    }),
    prisma.product.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, category: true },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Add subscription" description="Link a customer to a plan." />
      {customers.length === 0 ? (
        <div className="card p-6 text-sm text-[var(--muted)]">
          You need to add a customer first.{" "}
          <a href="/customers/new" className="text-indigo-600 hover:underline">Add a customer</a>.
        </div>
      ) : plans.length === 0 ? (
        <div className="card p-6 text-sm text-[var(--muted)]">
          You need to create a plan first.{" "}
          <a href="/plans/new" className="text-indigo-600 hover:underline">Add a plan</a>.
        </div>
      ) : (
        <SubscriptionForm
          action={createSubscription}
          customers={customers}
          plans={plans.map((p) => ({ ...p, price: String(p.price) }))}
          products={products}
          submitLabel="Create subscription"
          showInvoiceOption
        />
      )}
    </div>
  );
}
