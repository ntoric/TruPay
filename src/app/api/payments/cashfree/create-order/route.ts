import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getCashfreeConfig } from "@/lib/payments/cashfree-config";
import { createOrder } from "@/lib/payments/cashfree";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await getCashfreeConfig(user.id);
  if (!cfg) {
    return NextResponse.json(
      { error: "Cashfree is not configured. Please set up Cashfree in Settings." },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { invoiceId } = body as { invoiceId?: string };
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
    include: {
      customer: true,
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
    },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const totalPaid = invoice.payments.reduce(
    (s, p) => s + Number(p.amount),
    0,
  );
  const due = Number(invoice.total) - totalPaid;
  if (due <= 0) {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  const settings = await prisma.settings.findUnique({
    where: { userId: user.id },
    select: { currency: true, companyName: true },
  });
  const currency = settings?.currency ?? "INR";

  const orderId = `inv_${invoice.invoiceNumber}_${Date.now()}`;
  const origin = new URL(request.url).origin;
  const returnUrl = `${origin}/invoices/${invoice.id}?payment=done`;

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
      returnUrl,
      notifyUrl: `${origin}/api/payments/cashfree/webhook`,
      notes: { invoiceId, invoiceNumber: invoice.invoiceNumber },
    });

    return NextResponse.json({
      orderId: order.order_id,
      cfOrderId: order.cf_order_id,
      paymentSessionId: order.payment_session_id,
      orderAmount: order.order_amount,
      orderCurrency: order.order_currency,
      orderStatus: order.order_status,
      returnUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create Cashfree order: ${msg}` },
      { status: 500 },
    );
  }
}
