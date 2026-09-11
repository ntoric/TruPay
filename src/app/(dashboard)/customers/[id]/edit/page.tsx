import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import CustomerForm from "@/components/customers/customer-form";
import { updateCustomer } from "@/app/actions/customers";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: PageProps<"/customers/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, userId: user.id },
  });
  if (!customer) notFound();

  const action = updateCustomer.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit customer" description={customer.name} />
      <CustomerForm
        action={action}
        initial={customer}
        submitLabel="Save changes"
      />
    </div>
  );
}
