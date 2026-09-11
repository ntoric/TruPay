import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/invoices/:id — a single invoice with items and payments. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true, address: true } },
      subscription: { select: { id: true } },
      items: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) return apiError("Invoice not found", 404);

  return apiJson({
    data: {
      ...invoice,
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      items: invoice.items.map((it) => ({
        ...it,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        total: Number(it.total),
      })),
      payments: invoice.payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    },
  });
}
