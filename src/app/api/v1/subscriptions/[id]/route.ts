import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/subscriptions/:id — a single subscription with relations. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { id } = await params;
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      plan: true,
      product: { select: { id: true, name: true, sku: true } },
      invoices: { orderBy: { createdAt: "desc" }, select: { id: true, invoiceNumber: true, status: true, total: true, dueDate: true } },
    },
  });
  if (!subscription) return apiError("Subscription not found", 404);

  return apiJson({
    data: {
      ...subscription,
      price: Number(subscription.price),
      invoices: subscription.invoices.map((i) => ({ ...i, total: Number(i.total) })),
      plan: { ...subscription.plan, price: Number(subscription.plan.price) },
    },
  });
}
