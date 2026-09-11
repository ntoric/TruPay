import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["REMINDER", "ALERT", "NOTIFICATION"]),
  triggerType: z.enum([
    "BEFORE_RENEWAL", "ON_RENEWAL", "AFTER_RENEWAL", "PAYMENT_DUE",
    "PAYMENT_OVERDUE", "SUBSCRIPTION_EXPIRED", "INVOICE_CREATED",
    "INVOICE_PAID", "CUSTOM",
  ]),
  daysOffset: z.coerce.number().int().default(0),
  channels: z.array(z.enum(["EMAIL", "SMS", "TELEGRAM"])),
  subjectTemplate: z.string().nullish(),
  messageTemplate: z.string().min(1),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const rules = await prisma.notificationRule.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonResponse(rules);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;
  const rule = await prisma.notificationRule.create({
    data: {
      userId: user.id,
      name: d.name,
      type: d.type,
      triggerType: d.triggerType,
      daysOffset: d.daysOffset,
      channels: d.channels,
      subjectTemplate: d.subjectTemplate ?? null,
      messageTemplate: d.messageTemplate,
      isActive: d.isActive ?? true,
    },
  });
  return jsonResponse(rule, 201);
}
