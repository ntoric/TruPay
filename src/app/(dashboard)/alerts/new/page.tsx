import PageHeader from "@/components/layout/page-header";
import RuleForm from "@/components/alerts/rule-form";
import { createRule } from "@/app/actions/alerts";

export default function NewRulePage() {
  return (
    <div>
      <PageHeader title="Add notification rule" description="Automate reminders and alerts to your customers." />
      <RuleForm action={createRule} submitLabel="Create rule" />
    </div>
  );
}
