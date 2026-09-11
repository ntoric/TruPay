import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import InvoiceForm from "@/components/invoices/invoice-form";
import { updateInvoice } from "@/app/actions/invoices";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: PageProps<"/invoices/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!invoice) notFound();

  const [customers, subscriptions] = await Promise.all([
    prisma.customer.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { customer: true, plan: true },
      take: 50,
    }),
  ]);

  const action = updateInvoice.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit invoice" description={invoice.invoiceNumber} />
      <InvoiceForm
        action={action}
        customers={customers}
        subscriptions={subscriptions.map((s) => ({
          id: s.id,
          label: `${s.customer.name} — ${s.plan.name}`,
        }))}
        initial={{
          customerId: invoice.customerId,
          subscriptionId: invoice.subscriptionId,
          issueDate: invoice.issueDate.toISOString(),
          dueDate: invoice.dueDate.toISOString(),
          status: invoice.status,
          taxRate: Number(invoice.taxRate),
          discount: Number(invoice.discount),
          notes: invoice.notes,
          items: invoice.items.map((it) => ({
            description: it.description,
            quantity: String(it.quantity),
            unitPrice: String(it.unitPrice),
          })),
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
