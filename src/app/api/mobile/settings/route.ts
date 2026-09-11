import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  smtpHost: z.string().nullish(),
  smtpPort: z.coerce.number().int().nullish(),
  smtpUser: z.string().nullish(),
  smtpPass: z.string().nullish(),
  smtpFrom: z.string().nullish(),
  smtpSecure: z.boolean().optional(),
  smsProvider: z.string().optional(),
  twilioAccountSid: z.string().nullish(),
  twilioAuthToken: z.string().nullish(),
  twilioFromNumber: z.string().nullish(),
  vonageApiKey: z.string().nullish(),
  vonageApiSecret: z.string().nullish(),
  vonageFromNumber: z.string().nullish(),
  telegramBotToken: z.string().nullish(),
  telegramBotUsername: z.string().nullish(),
  cashfreeEnabled: z.boolean().optional(),
  cashfreeAppId: z.string().nullish(),
  cashfreeSecretKey: z.string().nullish(),
  cashfreeEnvironment: z.enum(["sandbox", "production"]).optional(),
  cashfreeWebhookSecret: z.string().nullish(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  companyName: z.string().nullish(),
  companyAddress: z.string().nullish(),
  companyEmail: z.string().nullish(),
  companyPhone: z.string().nullish(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  let settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  if (!settings) {
    settings = await prisma.settings.create({ data: { userId: user.id } });
  }
  return jsonResponse(settings);
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const data = parsed.data;
  // Ensure nullish optionals become null
  const cleaned = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, v === undefined ? undefined : v]),
  );
  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: cleaned,
    create: { userId: user.id, ...cleaned },
  });
  return jsonResponse(settings);
}
