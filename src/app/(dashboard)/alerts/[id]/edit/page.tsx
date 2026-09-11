import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import RuleForm from "@/components/alerts/rule-form";
import { updateRule } from "@/app/actions/alerts";

export const dynamic = "force-dynamic";

export default async function EditRulePage({
  params,
}: PageProps<"/alerts/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const rule = await prisma.notificationRule.findFirst({ where: { id, userId: user.id } });
  if (!rule) notFound();

  const action = updateRule.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit rule" description={rule.name} />
      <RuleForm
        action={action}
        initial={{
          name: rule.name,
          type: rule.type,
          triggerType: rule.triggerType,
          daysOffset: rule.daysOffset,
          channels: rule.channels,
          subjectTemplate: rule.subjectTemplate,
          messageTemplate: rule.messageTemplate,
          isActive: rule.isActive,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
