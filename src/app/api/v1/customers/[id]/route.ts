import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/customers/:id — a single customer with related subscriptions. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, userId: user.id },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        include: { plan: { select: { name: true, billingCycle: true } } },
      },
      _count: { select: { subscriptions: true, invoices: true } },
    },
  });
  if (!customer) return apiError("Customer not found", 404);

  return apiJson({ data: customer });
}
