import { prisma } from "@/lib/prisma";
import { addDays, generateInvoiceNumber } from "@/lib/utils";
import { getCashfreeConfig } from "@/lib/payments/cashfree-config";
import { createOrder, buildCheckoutUrl } from "@/lib/payments/cashfree";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

/**
 * Maintenance job run by the cron endpoint:
 *  - Auto-renew subscriptions with autoRenew=true whose cycle ended
 *  - Mark expired subscriptions
 *  - Mark overdue invoices
 * Returns a summary.
 */
export async function runMaintenance(): Promise<{
  renewed: number;
  expired: number;
  overdue: number;
  autoChargeLinks: number;
}> {
  const now = new Date();

  // 1. Auto-renew subscriptions whose endDate has passed and autoRenew is on
  const toRenew = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      endDate: { lt: now },
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
    },
    include: { plan: true, customer: true, product: true },
  });

  let renewed = 0;
  let autoChargeLinks = 0;
  for (const sub of toRenew) {
    const newStart = sub.endDate;
    const newEnd = addDays(newStart, sub.plan.durationDays);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { startDate: newStart, endDate: newEnd, status: "ACTIVE" },
    });

    // generate renewal invoice
    const settings = await prisma.settings.findUnique({ where: { userId: sub.userId } });
    const price = Number(sub.price);
    const currency = settings?.currency ?? "INR";
    const invoice = await prisma.invoice.create({
      data: {
        userId: sub.userId,
        customerId: sub.customerId,
        subscriptionId: sub.id,
        invoiceNumber: generateInvoiceNumber(),
        issueDate: now,
        dueDate: addDays(now, 7),
        status: "SENT",
        subtotal: price,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        total: price,
        currency,
        items: {
          create: [
            {
              description: `${sub.plan.name} — renewal (${sub.plan.billingCycle})${sub.product ? ` — ${sub.product.name}` : ""}`,
              quantity: 1,
              unitPrice: price,
              total: price,
            },
          ],
        },
      },
    });

    // Outbound webhooks for the auto-renewal
    await dispatchWebhookEvent(sub.userId, "subscription.renewed", {
      id: sub.id,
      startDate: newStart,
      endDate: newEnd,
      status: "ACTIVE",
      autoRenew: true,
    });
    await dispatchWebhookEvent(sub.userId, "invoice.created", {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subscriptionId: sub.id,
      customerId: sub.customerId,
      status: invoice.status,
      total: Number(invoice.total),
      currency: invoice.currency,
    });

    // If Cashfree is enabled, create a payment order and send a payment link
    const cfg = await getCashfreeConfig(sub.userId);
    if (cfg && sub.customer.email) {
      try {
        const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:6000";
        const orderId = `inv_${invoice.invoiceNumber}_${Date.now()}`;
        const order = await createOrder(cfg, {
          orderId,
          amount: price,
          currency,
          customer: {
            id: sub.customerId,
            name: sub.customer.name,
            email: sub.customer.email,
            phone: sub.customer.phone || "9999999999",
          },
          notifyUrl: `${origin}/api/payments/cashfree/webhook`,
          returnUrl: `${origin}/invoices/${invoice.id}?payment=done`,
          notes: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
        });

        // Store the order id on a pending payment record for webhook matching
        await prisma.payment.create({
          data: {
            userId: sub.userId,
            invoiceId: invoice.id,
            amount: price,
            method: "ONLINE",
            status: "PENDING",
            gateway: "cashfree",
            cashfreeOrderId: order.order_id,
            notes: "Auto-renewal payment link",
          },
        });

        // Send payment link email to the customer
        const checkoutUrl = buildCheckoutUrl(cfg.environment, order.payment_session_id, `${origin}/invoices/${invoice.id}?payment=done`);
        if (settings?.emailEnabled) {
          const { sendEmail } = await import("@/lib/notifications/email");
          await sendEmail(
            settings,
            sub.customer.email,
            `Payment due: Invoice ${invoice.invoiceNumber}`,
            `Your subscription "${sub.plan.name}" has been renewed. Please complete your payment of ${currency} ${price.toFixed(2)} using the link below:\n\n${checkoutUrl}\n\nInvoice: ${invoice.invoiceNumber}`,
            `<p>Your subscription "<strong>${sub.plan.name}</strong>" has been renewed.</p><p>Please complete your payment of <strong>${currency} ${price.toFixed(2)}</strong> using the link below:</p><p><a href="${checkoutUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Pay Now</a></p><p>Invoice: ${invoice.invoiceNumber}</p>`,
          ).catch(() => {});
        }

        autoChargeLinks++;
      } catch {
        // If Cashfree order creation fails, the invoice is still created
        // Customer can pay manually from the invoice page
      }
    }
    renewed++;
  }

  // 2. Mark expired subscriptions (not auto-renew, endDate passed)
  const expiring = await prisma.subscription.findMany({
    where: {
      endDate: { lt: now },
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      autoRenew: false,
    },
    select: { id: true, userId: true, customerId: true, endDate: true },
  });
  const expiredResult = await prisma.subscription.updateMany({
    where: {
      endDate: { lt: now },
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
      autoRenew: false,
    },
    data: { status: "EXPIRED" },
  });
  // Emit subscription.expired for each (grouped by user to minimize queries)
  const expiredByUser = new Map<string, typeof expiring>();
  for (const s of expiring) {
    if (!expiredByUser.has(s.userId)) expiredByUser.set(s.userId, []);
    expiredByUser.get(s.userId)!.push(s);
  }
  for (const [userId, subs] of expiredByUser) {
    for (const s of subs) {
      await dispatchWebhookEvent(userId, "subscription.expired", {
        id: s.id,
        customerId: s.customerId,
        endDate: s.endDate,
        status: "EXPIRED",
      });
    }
  }

  // 3. Mark overdue invoices
  const overdueResult = await prisma.invoice.updateMany({
    where: {
      dueDate: { lt: now },
      status: { in: ["SENT", "PARTIAL"] },
    },
    data: { status: "OVERDUE" },
  });

  return {
    renewed,
    expired: expiredResult.count,
    overdue: overdueResult.count,
    autoChargeLinks,
  };
}
