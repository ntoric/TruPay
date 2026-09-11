import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError, parsePagination } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/customers — list customers (paginated). */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { limit, offset } = parsePagination(req.nextUrl.searchParams);
  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where: search
        ? {
            userId: user.id,
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
            ],
          }
        : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.customer.count({ where: { userId: user.id } }),
  ]);

  return apiJson({
    data: customers,
    pagination: { limit, offset, total, hasMore: offset + customers.length < total },
  });
}
