import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { getCashfreeConfig } from "@/lib/payments/cashfree-config";
import { verifyAndRecordPayment } from "@/lib/payments/process-payment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getUserFromAuthHeader(
    request.headers.get("authorization"),
  );
  if (!user) return errorResponse("Unauthorized", 401);

  const cfg = await getCashfreeConfig(user.id);
  if (!cfg) return errorResponse("Cashfree is not configured", 400);

  const body = await request.json();
  const { orderId, invoiceId } = body as {
    orderId?: string;
    invoiceId?: string;
  };
  if (!orderId || !invoiceId)
    return errorResponse("orderId and invoiceId are required", 400);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
    select: { id: true },
  });
  if (!invoice) return errorResponse("Invoice not found", 404);

  try {
    const result = await verifyAndRecordPayment({
      userId: user.id,
      invoiceId,
      orderId,
      cfg,
    });

    return jsonResponse({
      verified: result.verified,
      paymentStatus: result.paymentStatus,
      payment: result.payment,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(`Payment verification failed: ${msg}`, 500);
  }
}
