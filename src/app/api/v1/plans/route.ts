import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError, parsePagination } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/plans — list plans (paginated). */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { limit, offset } = parsePagination(req.nextUrl.searchParams);
  const activeOnly = req.nextUrl.searchParams.get("active") === "true";

  const where = { userId: user.id, ...(activeOnly ? { isActive: true } : {}) };
  const [plans, total] = await Promise.all([
    prisma.plan.findMany({ where, orderBy: { name: "asc" }, take: limit, skip: offset }),
    prisma.plan.count({ where }),
  ]);

  return apiJson({
    data: plans.map((p) => ({ ...p, price: Number(p.price) })),
    pagination: { limit, offset, total, hasMore: offset + plans.length < total },
  });
}
