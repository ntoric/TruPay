import PageHeader from "@/components/layout/page-header";
import PlanForm from "@/components/plans/plan-form";
import { createPlan } from "@/app/actions/plans";

export default function NewPlanPage() {
  return (
    <div>
      <PageHeader title="Add plan" description="Create a new predefined or custom plan." />
      <PlanForm action={createPlan} submitLabel="Create plan" />
    </div>
  );
}
