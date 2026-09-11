import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  amount: z.coerce.number().min(0.01),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "ONLINE", "CHEQUE", "OTHER"]),
  status: z.enum(["PENDING", "COMPLETED", "FAILED", "REFUNDED"]).optional(),
  transactionId: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { payments: true },
  });
  if (!invoice) return errorResponse("Invoice not found", 404);

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      invoiceId: id,
      amount: d.amount,
      method: d.method,
      status: d.status ?? "COMPLETED",
      transactionId: d.transactionId ?? null,
      notes: d.notes ?? null,
    },
  });

  // Update invoice status based on total payments
  const allPayments = [...invoice.payments.map((p) => Number(p.amount)), d.amount];
  const paidTotal = allPayments.reduce((s, a) => s + a, 0);
  const invoiceTotal = Number(invoice.total);
  let newStatus = invoice.status;
  if (paidTotal >= invoiceTotal) newStatus = "PAID";
  else if (paidTotal > 0) newStatus = "PARTIAL";
  if (newStatus !== invoice.status) {
    await prisma.invoice.update({ where: { id }, data: { status: newStatus } });
  }

  return jsonResponse({ ...payment, amount: Number(payment.amount) }, 201);
}
