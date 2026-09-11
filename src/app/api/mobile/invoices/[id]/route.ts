import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  customerId: z.string().min(1).optional(),
  subscriptionId: z.string().nullish(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"]).optional(),
  subtotal: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
  notes: z.string().nullish(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { customer: true, subscription: true, items: true, payments: true },
  });
  if (!invoice) return errorResponse("Invoice not found", 404);
  return jsonResponse({
    ...invoice,
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
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
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const existing = await prisma.invoice.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Invoice not found", 404);
  const d = parsed.data;
  const subtotal = d.subtotal ?? Number(existing.subtotal);
  const taxRate = d.taxRate ?? Number(existing.taxRate);
  const discount = d.discount ?? Number(existing.discount);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount - discount;
  const invoice = await prisma.invoice.update({
    where: { id },
    data: { ...d, taxAmount, total },
  });
  return jsonResponse({
    ...invoice,
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const existing = await prisma.invoice.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Invoice not found", 404);
  await prisma.invoice.delete({ where: { id } });
  return jsonResponse({ success: true });
}
