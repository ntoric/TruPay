import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { getCashfreeConfig } from "@/lib/payments/cashfree-config";
import { createOrder } from "@/lib/payments/cashfree";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!user) return errorResponse("Unauthorized", 401);

  const cfg = await getCashfreeConfig(user.id);
  if (!cfg) {
    return errorResponse("Cashfree is not configured. Set it up in Settings.", 400);
  }

  const body = await request.json();
  const { invoiceId } = body as { invoiceId?: string };
  if (!invoiceId) return errorResponse("invoiceId is required", 400);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
    include: {
      customer: true,
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
    },
  });
  if (!invoice) return errorResponse("Invoice not found", 404);

  const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = Number(invoice.total) - totalPaid;
  if (due <= 0) return errorResponse("Invoice is already paid", 400);

  const settings = await prisma.settings.findUnique({
    where: { userId: user.id },
    select: { currency: true },
  });
  const currency = settings?.currency ?? "INR";

  const orderId = `inv_${invoice.invoiceNumber}_${Date.now()}`;
  const origin = new URL(request.url).origin;

  try {
    const order = await createOrder(cfg, {
      orderId,
      amount: due,
      currency,
      customer: {
        id: invoice.customerId,
        name: invoice.customer.name,
        email: invoice.customer.email || "noreply@example.com",
        phone: invoice.customer.phone || "9999999999",
      },
      notifyUrl: `${origin}/api/payments/cashfree/webhook`,
      notes: { invoiceId, invoiceNumber: invoice.invoiceNumber },
    });

    // Store a PENDING payment placeholder so this order is trackable for
    // asynchronous reconciliation if the webhook is missed.
    await prisma.payment.create({
      data: {
        userId: user.id,
        invoiceId: invoice.id,
        amount: due,
        method: "ONLINE",
        status: "PENDING",
        gateway: "cashfree",
        cashfreeOrderId: order.order_id,
        notes: "Cashfree order created (awaiting payment)",
      },
    });

    return jsonResponse({
      orderId: order.order_id,
      cfOrderId: order.cf_order_id,
      paymentSessionId: order.payment_session_id,
      orderAmount: order.order_amount,
      orderCurrency: order.order_currency,
      orderStatus: order.order_status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Failed to create Cashfree order: ${msg}`, 500);
  }
}
