import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import PaymentForm from "@/components/invoices/payment-form";
import SendInvoiceButton from "@/components/invoices/send-invoice-button";
import CashfreePayButton from "@/components/invoices/cashfree-pay-button";
import { recordPayment } from "@/app/actions/invoices";
import { ArrowLeft, Pencil, Download } from "lucide-react";
import { formatCurrency, formatDate, statusColor, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: PageProps<"/invoices/[id]">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: {
      customer: true,
      subscription: { include: { plan: true } },
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = invoice.currency;
  const totalPaid = invoice.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(invoice.total) - totalPaid);

  return (
    <div>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.customer.name} · ${formatCurrency(invoice.total, currency)}`}
        actions={
          <div className="flex items-center gap-2">
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer" className="btn-secondary">
              <Download className="h-4 w-4" /> PDF
            </a>
            <SendInvoiceButton id={invoice.id} />
            <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main: items + payments */}
        <div className="space-y-6 lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.description}</td>
                    <td className="text-right">{Number(it.quantity)}</td>
                    <td className="text-right">{formatCurrency(it.unitPrice, currency)}</td>
                    <td className="text-right font-medium">{formatCurrency(it.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end border-t border-[var(--border)] px-5 py-4">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-[var(--muted)]">Subtotal</span><span>{formatCurrency(invoice.subtotal, currency)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Tax ({Number(invoice.taxRate)}%)</span><span>{formatCurrency(invoice.taxAmount, currency)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--muted)]">Discount</span><span>-{formatCurrency(invoice.discount, currency)}</span></div>
                <div className="flex justify-between border-t border-[var(--border)] pt-1 text-base font-bold"><span>Total</span><span>{formatCurrency(invoice.total, currency)}</span></div>
                <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(totalPaid, currency)}</span></div>
                <div className="flex justify-between font-semibold text-rose-600"><span>Due</span><span>{formatCurrency(remaining, currency)}</span></div>
              </div>
            </div>
          </div>

          {/* Payments */}
          <div className="card overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-base font-semibold">Payments</h2>
            </div>
            {invoice.payments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">No payments recorded.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-[var(--muted)]">{formatDate(p.paidAt, true)}</td>
                      <td>{titleCase(p.method)}</td>
                      <td><span className={`badge ${statusColor(p.status)}`}>{titleCase(p.status)}</span></td>
                      <td className="text-right font-medium">{formatCurrency(p.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar: details + record payment */}
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Details</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Status</dt><dd><span className={`badge ${statusColor(invoice.status)}`}>{titleCase(invoice.status)}</span></dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Issue date</dt><dd>{formatDate(invoice.issueDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Due date</dt><dd>{formatDate(invoice.dueDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--muted)]">Currency</dt><dd>{invoice.currency}</dd></div>
              {invoice.subscription && (
                <div className="flex justify-between"><dt className="text-[var(--muted)]">Subscription</dt><dd>{invoice.subscription.plan.name}</dd></div>
              )}
            </dl>
            {invoice.notes && (
              <div className="mt-3 border-t border-[var(--border)] pt-3">
                <p className="text-xs text-[var(--muted)]">Notes</p>
                <p className="mt-1 text-sm">{invoice.notes}</p>
              </div>
            )}
          </div>

          {remaining > 0 && invoice.status !== "CANCELLED" && settings?.cashfreeEnabled && (
            <div className="card p-5">
              <h2 className="mb-3 text-base font-semibold">Pay online (Cashfree)</h2>
              <CashfreePayButton
                invoiceId={invoice.id}
                amount={remaining}
                currency={currency}
              />
            </div>
          )}

          {remaining > 0 && invoice.status !== "CANCELLED" && (
            <div className="card p-5">
              <h2 className="mb-3 text-base font-semibold">Record payment</h2>
              <PaymentForm
                action={recordPayment.bind(null, invoice.id)}
                remaining={remaining}
                currency={currency}
              />
            </div>
          )}

          <div className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Customer</h2>
            <p className="font-medium">{invoice.customer.name}</p>
            {invoice.customer.email && <p className="text-sm text-[var(--muted)]">{invoice.customer.email}</p>}
            {invoice.customer.phone && <p className="text-sm text-[var(--muted)]">{invoice.customer.phone}</p>}
            {invoice.customer.company && <p className="text-sm text-[var(--muted)]">{invoice.customer.company}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
