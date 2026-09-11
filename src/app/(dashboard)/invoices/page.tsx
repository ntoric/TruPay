import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import DeleteButton from "@/components/ui/delete-button";
import { deleteInvoice } from "@/app/actions/invoices";
import { FileText, Plus } from "lucide-react";
import { formatCurrency, formatDate, statusColor, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = settings?.currency ?? "INR";

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create, send and track invoices for your customers."
        actions={
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New invoice
          </Link>
        }
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No invoices yet"
          description="Create your first invoice, or one is generated automatically when you create a subscription."
          action={
            <Link href="/invoices/new" className="btn-primary">
              <Plus className="h-4 w-4" /> New invoice
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Issued</th>
                <th>Due</th>
                <th>Status</th>
                <th>Total</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td>{inv.customer.name}</td>
                  <td className="text-[var(--muted)]">{formatDate(inv.issueDate)}</td>
                  <td className="text-[var(--muted)]">{formatDate(inv.dueDate)}</td>
                  <td><span className={`badge ${statusColor(inv.status)}`}>{titleCase(inv.status)}</span></td>
                  <td className="font-medium">{formatCurrency(inv.total, currency)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/invoices/${inv.id}`} className="btn-ghost text-xs">View</Link>
                      <DeleteButton
                        onDelete={deleteInvoice.bind(null, inv.id)}
                        confirmMessage={`Delete invoice ${inv.invoiceNumber}?`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
