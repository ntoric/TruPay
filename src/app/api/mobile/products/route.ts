import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  sku: z.string().nullish(),
  category: z.string().nullish(),
  price: z.coerce.number().min(0),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const products = await prisma.product.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonResponse(
    products.map((p) => ({ ...p, price: Number(p.price) })),
  );
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;
  const product = await prisma.product.create({
    data: {
      userId: user.id,
      name: d.name,
      description: d.description ?? null,
      sku: d.sku ?? null,
      category: d.category ?? null,
      price: d.price,
      isActive: d.isActive ?? true,
    },
  });
  return jsonResponse({ ...product, price: Number(product.price) }, 201);
}
