import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { addDays } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const sub = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    include: { plan: true },
  });
  if (!sub) return errorResponse("Subscription not found", 404);

  const duration = sub.plan.durationDays || 30;
  const newEnd = addDays(sub.endDate, duration);
  const updated = await prisma.subscription.update({
    where: { id },
    data: { endDate: newEnd, status: "ACTIVE" },
    include: { customer: true, plan: true, product: true },
  });

  return jsonResponse({
    ...updated,
    price: Number(updated.price),
    plan: { ...updated.plan, price: Number(updated.plan.price) },
    product: updated.product ? { ...updated.product, price: Number(updated.product.price) } : null,
  });
}
