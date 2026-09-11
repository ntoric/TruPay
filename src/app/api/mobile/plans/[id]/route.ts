import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  price: z.coerce.number().min(0).optional(),
  billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).optional(),
  durationDays: z.coerce.number().int().min(1).optional(),
  features: z.any().optional(),
  isCustom: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const existing = await prisma.plan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Plan not found", 404);
  const plan = await prisma.plan.update({ where: { id }, data: parsed.data });
  return jsonResponse({ ...plan, price: Number(plan.price) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const existing = await prisma.plan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Plan not found", 404);
  await prisma.plan.delete({ where: { id } });
  return jsonResponse({ success: true });
}
