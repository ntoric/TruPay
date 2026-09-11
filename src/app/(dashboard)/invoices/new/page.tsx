import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import InvoiceForm from "@/components/invoices/invoice-form";
import { createInvoice } from "@/app/actions/invoices";

export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: PageProps<"/invoices/new">) {
  const user = await getSessionUser();
  if (!user) return null;
  const sp = await searchParams;

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

  return (
    <div>
      <PageHeader title="New invoice" description="Create an invoice with line items." />
      {customers.length === 0 ? (
        <div className="card p-6 text-sm text-[var(--muted)]">
          You need to add a customer first.{" "}
          <a href="/customers/new" className="text-indigo-600 hover:underline">Add a customer</a>.
        </div>
      ) : (
        <InvoiceForm
          action={createInvoice}
          customers={customers}
          subscriptions={subscriptions.map((s) => ({
            id: s.id,
            label: `${s.customer.name} — ${s.plan.name}`,
          }))}
          submitLabel="Create invoice"
          defaultCustomerId={typeof sp.customer === "string" ? sp.customer : undefined}
          defaultSubscriptionId={typeof sp.subscription === "string" ? sp.subscription : undefined}
        />
      )}
    </div>
  );
}
