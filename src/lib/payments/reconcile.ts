import { prisma } from "@/lib/prisma";
import { getCashfreeConfig } from "@/lib/payments/cashfree-config";
import { getPaymentsForOrder } from "@/lib/payments/cashfree";
import { recordCashfreePayment } from "@/lib/payments/process-payment";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

/**
 * Asynchronous Cashfree payment reconciliation.
 *
 * The webhook is the primary notification path, but it is unreliable: if the
 * system is unreachable when Cashfree sends it (and during its limited retry
 * window), the payment is never recorded — even though the customer paid. The
 * client-side `/verify` call only fires if the user returns to the app.
 *
 * This job, run periodically by the cron endpoint, polls the Cashfree API for
 * every PENDING Cashfree order and reconciles the local state:
 *  - SUCCESS  → record the payment (marks invoice PAID, fires webhooks, removes
 *               the PENDING placeholder). Idempotent via cashfreePaymentId.
 *  - FAILED / USER_DROPPED → mark the placeholder FAILED + emit payment.failed.
 *  - still PENDING → leave for the next run, unless the order is older than
 *    STALE_AFTER_DAYS (the Cashfree order will have expired by then), in which
 *    case mark it FAILED so we stop polling it indefinitely.
 */

/** Orders older than this with no terminal payment status are marked FAILED. */
const STALE_AFTER_DAYS = 7;
/** Only look back this far to bound work and avoid touching legacy data. */
const LOOKBACK_DAYS = 30;
/** Max orders processed per run. */
const BATCH_LIMIT = 200;

export interface ReconcileSummary {
  checked: number;
  reconciled: number;
  failed: number;
  stillPending: number;
  skipped: number;
  errors: string[];
}

export async function reconcileCashfreePayments(): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    checked: 0,
    reconciled: 0,
    failed: 0,
    stillPending: 0,
    skipped: 0,
    errors: [],
  };

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  // All PENDING cashfree payments that have an order id, within the lookback.
  const pending = await prisma.payment.findMany({
    where: {
      gateway: "cashfree",
      status: "PENDING",
      cashfreeOrderId: { not: null },
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_LIMIT,
    select: {
      id: true,
      userId: true,
      invoiceId: true,
      cashfreeOrderId: true,
      amount: true,
      createdAt: true,
    },
  });

  if (pending.length === 0) return summary;

  // Group by user so we load each user's Cashfree config once.
  const byUser = new Map<string, typeof pending>();
  for (const p of pending) {
    if (!byUser.has(p.userId)) byUser.set(p.userId, []);
    byUser.get(p.userId)!.push(p);
  }

  for (const [userId, payments] of byUser) {
    const cfg = await getCashfreeConfig(userId);
    if (!cfg) {
      // Cashfree not configured (anymore) — can't poll. Skip these.
      summary.skipped += payments.length;
      continue;
    }

    for (const p of payments) {
      summary.checked++;
      const orderId = p.cashfreeOrderId!;
      try {
        const apiPayments = await getPaymentsForOrder(cfg, orderId);
        const success = apiPayments.find((x) => x.payment_status === "SUCCESS");

        if (success) {
          await recordCashfreePayment({
            userId,
            invoiceId: p.invoiceId,
            amount: Number(success.payment_amount),
            cashfreeOrderId: orderId,
            cashfreePaymentId: String(success.cf_payment_id),
            transactionId: String(success.cf_payment_id),
          });
          summary.reconciled++;
          continue;
        }

        const terminalFailure = apiPayments.some((x) =>
          ["FAILED", "USER_DROPPED"].includes(x.payment_status),
        );

        if (terminalFailure || p.createdAt < staleBefore) {
          // Either the customer's attempt failed/dropped, or the order is stale
          // (Cashfree order has expired) with no successful payment. Mark FAILED.
          await prisma.payment.update({
            where: { id: p.id },
            data: {
              status: "FAILED",
              notes: terminalFailure
                ? "Cashfree payment failed/dropped (reconciled)"
                : "Cashfree order expired without payment (reconciled)",
            },
          });
          await dispatchWebhookEvent(userId, "payment.failed", {
            id: p.id,
            invoiceId: p.invoiceId,
            cashfreeOrderId: orderId,
            amount: Number(p.amount),
            reason: terminalFailure ? "payment_failed" : "order_expired",
          });
          summary.failed++;
        } else {
          // Order still open and recent — leave for the next run.
          summary.stillPending++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        summary.errors.push(`order ${orderId}: ${msg}`);
      }
    }
  }

  return summary;
}
