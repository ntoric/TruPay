import { prisma } from "@/lib/prisma";
import type { CashfreeConfig, CashfreePayment } from "./cashfree";
import { getPaymentsForOrder } from "./cashfree";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

/**
 * Record a successful Cashfree payment in the database.
 * Creates a Payment row, marks the invoice as PAID (or PARTIAL), and returns the payment.
 * Idempotent: if a payment with the same cashfreePaymentId already exists, returns it.
 */
export async function recordCashfreePayment(opts: {
  userId: string;
  invoiceId: string;
  amount: number;
  cashfreeOrderId: string;
  cashfreePaymentId: string;
  transactionId?: string;
}): Promise<{ paymentId: string; invoiceStatus: string; created: boolean }> {
  // Idempotency check
  const existing = await prisma.payment.findFirst({
    where: { cashfreePaymentId: opts.cashfreePaymentId },
    select: { id: true, invoiceId: true },
  });
  if (existing) {
    const inv = await prisma.invoice.findUnique({
      where: { id: existing.invoiceId },
      select: { status: true },
    });
    return {
      paymentId: existing.id,
      invoiceStatus: inv?.status ?? "PAID",
      created: false,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        userId: opts.userId,
        invoiceId: opts.invoiceId,
        amount: opts.amount,
        method: "ONLINE",
        status: "COMPLETED",
        transactionId: opts.transactionId ?? null,
        cashfreeOrderId: opts.cashfreeOrderId,
        cashfreePaymentId: opts.cashfreePaymentId,
        gateway: "cashfree",
        notes: "Paid via Cashfree Payment Gateway",
      },
    });

    // Calculate total paid for the invoice
    const payments = await tx.payment.findMany({
      where: { invoiceId: opts.invoiceId, status: "COMPLETED" },
      select: { amount: true },
    });
    const totalPaid = payments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );

    const invoice = await tx.invoice.findUnique({
      where: { id: opts.invoiceId },
      select: { total: true },
    });
    const invoiceTotal = invoice ? Number(invoice.total) : 0;

    const newStatus = totalPaid >= invoiceTotal ? "PAID" : "PARTIAL";
    await tx.invoice.update({
      where: { id: opts.invoiceId },
      data: { status: newStatus },
    });

    // Remove the PENDING placeholder row (if any) that was created when the
    // order was opened, so we don't leave a dangling PENDING payment alongside
    // the real COMPLETED one. The placeholder has cashfreeOrderId set but no
    // cashfreePaymentId; the real row we just created has cashfreePaymentId set.
    await tx.payment.deleteMany({
      where: {
        cashfreeOrderId: opts.cashfreeOrderId,
        cashfreePaymentId: null,
        status: "PENDING",
      },
    });

    return {
      paymentId: payment.id,
      invoiceStatus: newStatus,
      created: true,
      totalPaid,
    };
  });

  // Outbound webhooks (fire after the transaction commits)
  await dispatchWebhookEvent(opts.userId, "payment.recorded", {
    id: result.paymentId,
    invoiceId: opts.invoiceId,
    amount: opts.amount,
    method: "ONLINE",
    status: "COMPLETED",
    invoiceStatus: result.invoiceStatus,
    gateway: "cashfree",
  });
  if (result.invoiceStatus === "PAID") {
    await dispatchWebhookEvent(opts.userId, "invoice.paid", {
      id: opts.invoiceId,
      totalPaid: result.totalPaid,
    });
  }

  return { paymentId: result.paymentId, invoiceStatus: result.invoiceStatus, created: result.created };
}

/**
 * Verify a Cashfree order's payment status from the API and record if successful.
 */
export async function verifyAndRecordPayment(opts: {
  userId: string;
  invoiceId: string;
  orderId: string;
  cfg: CashfreeConfig;
}): Promise<{
  verified: boolean;
  paymentStatus: string;
  payment?: { paymentId: string; invoiceStatus: string; created: boolean };
}> {
  const payments = await getPaymentsForOrder(opts.cfg, opts.orderId);
  const successful = payments.find((p) => p.payment_status === "SUCCESS");

  if (!successful) {
    return {
      verified: false,
      paymentStatus: payments[0]?.payment_status ?? "PENDING",
    };
  }

  const result = await recordCashfreePayment({
    userId: opts.userId,
    invoiceId: opts.invoiceId,
    amount: Number(successful.payment_amount),
    cashfreeOrderId: successful.order_id,
    cashfreePaymentId: String(successful.cf_payment_id),
    transactionId: String(successful.cf_payment_id),
  });

  return {
    verified: true,
    paymentStatus: "SUCCESS",
    payment: result,
  };
}

export type { CashfreePayment };
