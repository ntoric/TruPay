import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError, parsePagination } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/subscriptions — list subscriptions (paginated, filterable by status). */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { limit, offset } = parsePagination(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const customerId = req.nextUrl.searchParams.get("customerId") ?? undefined;

  const where = {
    userId: user.id,
    ...(status ? { status: status as never } : {}),
    ...(customerId ? { customerId } : {}),
  };

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        plan: { select: { id: true, name: true, billingCycle: true } },
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);

  return apiJson({
    data: subscriptions.map((s) => ({ ...s, price: Number(s.price) })),
    pagination: { limit, offset, total, hasMore: offset + subscriptions.length < total },
  });
}
