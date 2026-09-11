import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import PlanForm from "@/components/plans/plan-form";
import { updatePlan } from "@/app/actions/plans";

export const dynamic = "force-dynamic";

export default async function EditPlanPage({
  params,
}: PageProps<"/plans/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const plan = await prisma.plan.findFirst({ where: { id, userId: user.id } });
  if (!plan) notFound();

  const action = updatePlan.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit plan" description={plan.name} />
      <PlanForm
        action={action}
        initial={{
          name: plan.name,
          description: plan.description,
          price: Number(plan.price),
          billingCycle: plan.billingCycle,
          durationDays: plan.durationDays,
          features: plan.features as string[] | null,
          isActive: plan.isActive,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
