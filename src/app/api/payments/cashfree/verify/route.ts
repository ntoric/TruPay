import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getCashfreeConfig } from "@/lib/payments/cashfree-config";
import { verifyAndRecordPayment } from "@/lib/payments/process-payment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cfg = await getCashfreeConfig(user.id);
  if (!cfg) {
    return NextResponse.json(
      { error: "Cashfree is not configured" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { orderId, invoiceId } = body as {
    orderId?: string;
    invoiceId?: string;
  };
  if (!orderId || !invoiceId) {
    return NextResponse.json(
      { error: "orderId and invoiceId are required" },
      { status: 400 },
    );
  }

  // Verify the invoice belongs to the user
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const result = await verifyAndRecordPayment({
      userId: user.id,
      invoiceId,
      orderId,
      cfg,
    });

    return NextResponse.json({
      verified: result.verified,
      paymentStatus: result.paymentStatus,
      payment: result.payment,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Payment verification failed: ${msg}` },
      { status: 500 },
    );
  }
}
