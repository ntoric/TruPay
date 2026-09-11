import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError, parsePagination } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/payments — list payments (paginated, filterable by status). */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { limit, offset } = parsePagination(req.nextUrl.searchParams);
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const invoiceId = req.nextUrl.searchParams.get("invoiceId") ?? undefined;

  const where = {
    userId: user.id,
    ...(status ? { status: status as never } : {}),
    ...(invoiceId ? { invoiceId } : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: limit,
      skip: offset,
      include: { invoice: { select: { id: true, invoiceNumber: true, status: true } } },
    }),
    prisma.payment.count({ where }),
  ]);

  return apiJson({
    data: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
    pagination: { limit, offset, total, hasMore: offset + payments.length < total },
  });
}
