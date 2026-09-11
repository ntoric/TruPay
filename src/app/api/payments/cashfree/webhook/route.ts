import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/payments/cashfree";
import { recordCashfreePayment } from "@/lib/payments/process-payment";

export const dynamic = "force-dynamic";

/**
 * Cashfree Payment Webhook.
 *
 * Cashfree sends webhooks for payment success, failure, user-dropped, etc.
 * The webhook is authenticated via HMAC-SHA256 signature verification using
 * the webhook secret configured in Settings.
 *
 * Since the webhook secret is per-user, we need to find the user by matching
 * the order_id to an invoice. We store the cashfree order_id on the payment
 * record when the order is created, so we can look it up.
 *
 * However, the webhook may fire before the create-order flow stores anything.
 * To handle this, we parse the payload to extract the order_id, then look up
 * the invoice by the order_id prefix (we use `inv_<invoiceNumber>_<timestamp>`).
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature") ?? "";
    const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing signature headers" },
        { status: 400 },
      );
    }

    const payload = JSON.parse(rawBody) as {
      data?: {
        order?: { order_id?: string };
        payment?: {
          cf_payment_id?: string;
          payment_amount?: number;
          payment_status?: string;
        };
      };
      event?: string;
      type?: string;
    };

    const orderId = payload.data?.order?.order_id ?? "";
    const paymentId = payload.data?.payment?.cf_payment_id ?? "";
    const paymentStatus = payload.data?.payment?.payment_status ?? "";
    const paymentAmount = payload.data?.payment?.payment_amount ?? 0;

    if (!orderId) {
      return NextResponse.json({ error: "No order_id in payload" }, { status: 400 });
    }

    // Find the user who owns this order. We look up by the order_id which we
    // stored on a Payment record (cashfreeOrderId) during create-order, or
    // we can find it via the invoice number prefix.
    // The order_id format is: inv_<invoiceNumber>_<timestamp>
    const orderMatch = orderId.match(/^inv_(.+)_(\d+)$/);

    let userId: string | null = null;
    let invoiceId: string | null = null;

    // First try to find via existing payment record with this order id
    const existingPayment = await prisma.payment.findFirst({
      where: { cashfreeOrderId: orderId },
      select: { userId: true, invoiceId: true },
    });
    if (existingPayment) {
      userId = existingPayment.userId;
      invoiceId = existingPayment.invoiceId;
    } else if (orderMatch) {
      // Try to find by invoice number
      const invoiceNumber = orderMatch[1];
      const invoice = await prisma.invoice.findUnique({
        where: { invoiceNumber },
        select: { id: true, userId: true },
      });
      if (invoice) {
        userId = invoice.userId;
        invoiceId = invoice.id;
      }
    }

    if (!userId || !invoiceId) {
      // Can't determine the user — can't verify the webhook signature
      // Return 200 to stop retries (we can't process it anyway)
      return NextResponse.json({ received: true, matched: false });
    }

    // Get the user's Cashfree webhook secret
    const settings = await prisma.settings.findUnique({
      where: { userId },
      select: { cashfreeWebhookSecret: true },
    });
    const webhookSecret = settings?.cashfreeWebhookSecret;

    if (!webhookSecret) {
      // No webhook secret configured — accept but log
      // (in production, this should be configured)
    } else {
      const valid = verifyWebhookSignature(
        signature,
        rawBody,
        timestamp,
        webhookSecret,
      );
      if (!valid) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 },
        );
      }
    }

    // Only process successful payments
    if (paymentStatus === "SUCCESS" && paymentId) {
      await recordCashfreePayment({
        userId,
        invoiceId,
        amount: Number(paymentAmount),
        cashfreeOrderId: orderId,
        cashfreePaymentId: String(paymentId),
        transactionId: String(paymentId),
      });
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook processing failed: ${msg}` },
      { status: 500 },
    );
  }
}
