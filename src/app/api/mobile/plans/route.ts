import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  price: z.coerce.number().min(0),
  billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  durationDays: z.coerce.number().int().min(1),
  features: z.any().optional(),
  isCustom: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const plans = await prisma.plan.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonResponse(plans.map((p) => ({ ...p, price: Number(p.price) })));
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;
  const plan = await prisma.plan.create({
    data: {
      userId: user.id,
      name: d.name,
      description: d.description ?? null,
      price: d.price,
      billingCycle: d.billingCycle,
      durationDays: d.durationDays,
      features: d.features ?? null,
      isCustom: d.isCustom ?? false,
      isActive: d.isActive ?? true,
    },
  });
  return jsonResponse({ ...plan, price: Number(plan.price) }, 201);
}
