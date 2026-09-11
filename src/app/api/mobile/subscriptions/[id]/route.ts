import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  customerId: z.string().min(1).optional(),
  planId: z.string().min(1).optional(),
  productId: z.string().nullish(),
  status: z.enum(["ACTIVE", "PENDING", "EXPIRED", "CANCELLED", "PAST_DUE", "TRIALING"]).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  autoRenew: z.boolean().optional(),
  price: z.coerce.number().min(0).optional(),
  notes: z.string().nullish(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const sub = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    include: {
      customer: true,
      plan: true,
      product: true,
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!sub) return errorResponse("Subscription not found", 404);
  return jsonResponse({
    ...sub,
    price: Number(sub.price),
    plan: { ...sub.plan, price: Number(sub.plan.price) },
    product: sub.product ? { ...sub.product, price: Number(sub.product.price) } : null,
    invoices: sub.invoices.map((i) => ({
      ...i,
      subtotal: Number(i.subtotal),
      taxRate: Number(i.taxRate),
      taxAmount: Number(i.taxAmount),
      discount: Number(i.discount),
      total: Number(i.total),
    })),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const existing = await prisma.subscription.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Subscription not found", 404);
  const sub = await prisma.subscription.update({ where: { id }, data: parsed.data });
  return jsonResponse({ ...sub, price: Number(sub.price) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const existing = await prisma.subscription.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Subscription not found", 404);
  await prisma.subscription.delete({ where: { id } });
  return jsonResponse({ success: true });
}
