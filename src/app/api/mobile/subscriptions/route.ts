import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { addDays } from "@/lib/utils";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  customerId: z.string().min(1),
  planId: z.string().min(1),
  productId: z.string().nullish(),
  status: z.enum(["ACTIVE", "PENDING", "EXPIRED", "CANCELLED", "PAST_DUE", "TRIALING"]),
  startDate: z.coerce.date(),
  durationDays: z.coerce.number().int().min(1).optional(),
  price: z.coerce.number().min(0).optional(),
  autoRenew: z.boolean().optional(),
  notes: z.string().nullish(),
  createInvoice: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const where: Record<string, unknown> = { userId: user.id };
  if (productId) where.productId = productId;
  if (status) where.status = status;
  const subs = await prisma.subscription.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { customer: true, plan: true, product: true },
  });
  return jsonResponse(
    subs.map((s) => ({
      ...s,
      price: Number(s.price),
      plan: { ...s.plan, price: Number(s.plan.price) },
      product: s.product ? { ...s.product, price: Number(s.product.price) } : null,
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

  const plan = await prisma.plan.findFirst({ where: { id: d.planId, userId: user.id } });
  if (!plan) return errorResponse("Plan not found", 404);
  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: user.id } });
  if (!customer) return errorResponse("Customer not found", 404);
  if (d.productId) {
    const product = await prisma.product.findFirst({ where: { id: d.productId, userId: user.id } });
    if (!product) return errorResponse("Product not found", 404);
  }

  const duration = d.durationDays ?? plan.durationDays;
  const price = d.price ?? Number(plan.price);
  const endDate = addDays(d.startDate, duration);

  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      customerId: d.customerId,
      planId: d.planId,
      productId: d.productId ?? null,
      status: d.status,
      startDate: d.startDate,
      endDate,
      autoRenew: d.autoRenew ?? false,
      price,
      notes: d.notes ?? null,
    },
    include: { customer: true, plan: true, product: true },
  });

  if (d.createInvoice) {
    const { generateInvoiceNumber } = await import("@/lib/utils");
    const subtotal = price;
    const total = price;
    await prisma.invoice.create({
      data: {
        userId: user.id,
        customerId: d.customerId,
        subscriptionId: sub.id,
        invoiceNumber: generateInvoiceNumber(),
        issueDate: new Date(),
        dueDate: endDate,
        status: "SENT",
        subtotal,
        taxRate: 0,
        taxAmount: 0,
        discount: 0,
        total,
        currency: "INR",
        items: {
          create: [
            { description: plan.name, quantity: 1, unitPrice: price, total: price },
          ],
        },
      },
    });
  }

  return jsonResponse(
    {
      ...sub,
      price: Number(sub.price),
      plan: { ...sub.plan, price: Number(sub.plan.price) },
      product: sub.product ? { ...sub.product, price: Number(sub.product.price) } : null,
    },
    201,
  );
}
