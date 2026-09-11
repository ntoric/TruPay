import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError, parsePagination } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/invoices — list invoices (paginated, filterable by status). */
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

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        subscription: { select: { id: true } },
        _count: { select: { items: true, payments: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return apiJson({
    data: invoices.map((i) => ({
      ...i,
      subtotal: Number(i.subtotal),
      taxAmount: Number(i.taxAmount),
      discount: Number(i.discount),
      total: Number(i.total),
    })),
    pagination: { limit, offset, total, hasMore: offset + invoices.length < total },
  });
}
