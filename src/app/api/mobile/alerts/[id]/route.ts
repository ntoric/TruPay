import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["REMINDER", "ALERT", "NOTIFICATION"]).optional(),
  triggerType: z.enum([
    "BEFORE_RENEWAL", "ON_RENEWAL", "AFTER_RENEWAL", "PAYMENT_DUE",
    "PAYMENT_OVERDUE", "SUBSCRIPTION_EXPIRED", "INVOICE_CREATED",
    "INVOICE_PAID", "CUSTOM",
  ]).optional(),
  daysOffset: z.coerce.number().int().optional(),
  channels: z.array(z.enum(["EMAIL", "SMS", "TELEGRAM"])).optional(),
  subjectTemplate: z.string().nullish(),
  messageTemplate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const existing = await prisma.notificationRule.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Alert not found", 404);
  const rule = await prisma.notificationRule.update({ where: { id }, data: parsed.data });
  return jsonResponse(rule);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const existing = await prisma.notificationRule.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Alert not found", 404);
  await prisma.notificationRule.delete({ where: { id } });
  return jsonResponse({ success: true });
}
