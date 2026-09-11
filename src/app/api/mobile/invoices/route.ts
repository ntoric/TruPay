import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { generateInvoiceNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0),
  total: z.coerce.number().min(0),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  subscriptionId: z.string().nullish(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  status: z.enum(["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"]),
  subtotal: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  currency: z.string().optional(),
  notes: z.string().nullish(),
  items: z.array(itemSchema).min(1),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { customer: true, subscription: true },
  });
  return jsonResponse(
    invoices.map((i) => ({
      ...i,
      subtotal: Number(i.subtotal),
      taxRate: Number(i.taxRate),
      taxAmount: Number(i.taxAmount),
      discount: Number(i.discount),
      total: Number(i.total),
    })),
  );
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;

  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: user.id } });
  if (!customer) return errorResponse("Customer not found", 404);
  if (d.subscriptionId) {
    const sub = await prisma.subscription.findFirst({ where: { id: d.subscriptionId, userId: user.id } });
    if (!sub) return errorResponse("Subscription not found", 404);
  }

  const taxAmount = (d.subtotal * d.taxRate) / 100;
  const total = d.subtotal + taxAmount - d.discount;

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      customerId: d.customerId,
      subscriptionId: d.subscriptionId ?? null,
      invoiceNumber: generateInvoiceNumber(),
      issueDate: d.issueDate,
      dueDate: d.dueDate,
      status: d.status,
      subtotal: d.subtotal,
      taxRate: d.taxRate,
      taxAmount,
      discount: d.discount,
      total,
      currency: d.currency ?? "INR",
      notes: d.notes ?? null,
      items: {
        create: d.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
      },
    },
    include: { customer: true, subscription: true, items: true },
  });

  return jsonResponse(
    {
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
    },
    201,
  );
}
