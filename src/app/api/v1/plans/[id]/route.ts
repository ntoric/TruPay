import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/plans/:id — a single plan with active subscription count. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { id } = await params;
  const plan = await prisma.plan.findFirst({
    where: { id, userId: user.id },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!plan) return apiError("Plan not found", 404);

  return apiJson({ data: { ...plan, price: Number(plan.price) } });
}
