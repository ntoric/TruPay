import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/payments/:id — a single payment with its invoice. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { id } = await params;
  const payment = await prisma.payment.findFirst({
    where: { id, userId: user.id },
    include: {
      invoice: {
        select: { id: true, invoiceNumber: true, status: true, total: true, currency: true, customer: { select: { id: true, name: true } } },
      },
    },
  });
  if (!payment) return apiError("Payment not found", 404);

  return apiJson({
    data: {
      ...payment,
      amount: Number(payment.amount),
      invoice: { ...payment.invoice, total: Number(payment.invoice.total) },
    },
  });
}
