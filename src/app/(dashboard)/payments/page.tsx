import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import { Receipt } from "lucide-react";
import { formatCurrency, formatDate, statusColor, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = settings?.currency ?? "INR";

  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { paidAt: "desc" },
    include: { invoice: { include: { customer: true } } },
    take: 200,
  });

  const totalCollected = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div>
      <PageHeader
        title="Payments"
        description="All recorded payments across invoices."
      />

      {payments.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="No payments yet"
          description="Payments are recorded from invoice detail pages."
        />
      ) : (
        <>
          <div className="mb-4 card p-4 text-sm">
            <span className="text-[var(--muted)]">Total collected: </span>
            <span className="font-bold text-emerald-600">{formatCurrency(totalCollected, currency)}</span>
          </div>
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Invoice</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-[var(--muted)]">{formatDate(p.paidAt, true)}</td>
                    <td className="font-medium">{p.invoice.customer.name}</td>
                    <td>
                      <Link href={`/invoices/${p.invoiceId}`} className="text-indigo-600 hover:underline">
                        {p.invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{titleCase(p.method)}</td>
                    <td><span className={`badge ${statusColor(p.status)}`}>{titleCase(p.status)}</span></td>
                    <td className="text-right font-medium">{formatCurrency(p.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
