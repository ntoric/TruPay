import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** GET /api/v1/products/:id — a single product. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);

  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, userId: user.id } });
  if (!product) return apiError("Product not found", 404);

  return apiJson({ data: { ...product, price: Number(product.price) } });
}
