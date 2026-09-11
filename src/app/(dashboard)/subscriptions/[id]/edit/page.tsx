import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import SubscriptionForm from "@/components/subscriptions/subscription-form";
import { updateSubscription } from "@/app/actions/subscriptions";

export const dynamic = "force-dynamic";

export default async function EditSubscriptionPage({
  params,
}: PageProps<"/subscriptions/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const sub = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
  });
  if (!sub) notFound();

  const [customers, plans, products] = await Promise.all([
    prisma.customer.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.plan.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true, billingCycle: true, durationDays: true },
    }),
    prisma.product.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, category: true },
    }),
  ]);

  const action = updateSubscription.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit subscription" description="Update subscription details." />
      <SubscriptionForm
        action={action}
        customers={customers}
        plans={plans.map((p) => ({ ...p, price: String(p.price) }))}
        products={products}
        initial={{
          customerId: sub.customerId,
          planId: sub.planId,
          productId: sub.productId,
          status: sub.status,
          startDate: sub.startDate.toISOString(),
          price: Number(sub.price),
          autoRenew: sub.autoRenew,
          notes: sub.notes,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
