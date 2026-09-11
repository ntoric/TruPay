"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import { verifyTelegramBot } from "@/lib/notifications/telegram";

const settingsSchema = z.object({
  // SMTP
  smtpHost: z.string().optional().or(z.literal("")),
  smtpPort: z.string().optional().or(z.literal("")),
  smtpUser: z.string().optional().or(z.literal("")),
  smtpPass: z.string().optional().or(z.literal("")),
  smtpFrom: z.string().optional().or(z.literal("")),
  smtpSecure: z.string().optional(),
  // SMS
  smsProvider: z.enum(["none", "twilio", "vonage"]),
  twilioAccountSid: z.string().optional().or(z.literal("")),
  twilioAuthToken: z.string().optional().or(z.literal("")),
  twilioFromNumber: z.string().optional().or(z.literal("")),
  vonageApiKey: z.string().optional().or(z.literal("")),
  vonageApiSecret: z.string().optional().or(z.literal("")),
  vonageFromNumber: z.string().optional().or(z.literal("")),
  // Telegram
  telegramBotToken: z.string().optional().or(z.literal("")),
  // Cashfree
  cashfreeEnabled: z.string().optional(),
  cashfreeAppId: z.string().optional().or(z.literal("")),
  cashfreeSecretKey: z.string().optional().or(z.literal("")),
  cashfreeEnvironment: z.enum(["sandbox", "production"]).default("sandbox"),
  cashfreeWebhookSecret: z.string().optional().or(z.literal("")),
  // General
  currency: z.string().min(3).max(5),
  timezone: z.string().optional().or(z.literal("")),
  companyName: z.string().optional().or(z.literal("")),
  companyAddress: z.string().optional().or(z.literal("")),
  companyEmail: z.string().optional().or(z.literal("")),
  companyPhone: z.string().optional().or(z.literal("")),
  // Toggles
  emailEnabled: z.string().optional(),
  smsEnabled: z.string().optional(),
  telegramEnabled: z.string().optional(),
});

export type SettingsFormState = { error?: string; telegramUsername?: string } | undefined;

export async function updateSettings(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireUser();

  const parsed = settingsSchema.safeParse({
    smtpHost: String(formData.get("smtpHost") ?? ""),
    smtpPort: String(formData.get("smtpPort") ?? ""),
    smtpUser: String(formData.get("smtpUser") ?? ""),
    smtpPass: String(formData.get("smtpPass") ?? ""),
    smtpFrom: String(formData.get("smtpFrom") ?? ""),
    smtpSecure: String(formData.get("smtpSecure") ?? ""),
    smsProvider: String(formData.get("smsProvider") ?? "none"),
    twilioAccountSid: String(formData.get("twilioAccountSid") ?? ""),
    twilioAuthToken: String(formData.get("twilioAuthToken") ?? ""),
    twilioFromNumber: String(formData.get("twilioFromNumber") ?? ""),
    vonageApiKey: String(formData.get("vonageApiKey") ?? ""),
    vonageApiSecret: String(formData.get("vonageApiSecret") ?? ""),
    vonageFromNumber: String(formData.get("vonageFromNumber") ?? ""),
    telegramBotToken: String(formData.get("telegramBotToken") ?? ""),
    cashfreeEnabled: String(formData.get("cashfreeEnabled") ?? ""),
    cashfreeAppId: String(formData.get("cashfreeAppId") ?? ""),
    cashfreeSecretKey: String(formData.get("cashfreeSecretKey") ?? ""),
    cashfreeEnvironment: String(formData.get("cashfreeEnvironment") ?? "sandbox"),
    cashfreeWebhookSecret: String(formData.get("cashfreeWebhookSecret") ?? ""),
    currency: String(formData.get("currency") ?? "INR"),
    timezone: String(formData.get("timezone") ?? "UTC"),
    companyName: String(formData.get("companyName") ?? ""),
    companyAddress: String(formData.get("companyAddress") ?? ""),
    companyEmail: String(formData.get("companyEmail") ?? ""),
    companyPhone: String(formData.get("companyPhone") ?? ""),
    emailEnabled: String(formData.get("emailEnabled") ?? ""),
    smsEnabled: String(formData.get("smsEnabled") ?? ""),
    telegramEnabled: String(formData.get("telegramEnabled") ?? ""),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  // If telegram token changed, verify and store username
  let telegramUsername: string | undefined;
  if (d.telegramBotToken) {
    const existing = await prisma.settings.findUnique({ where: { userId: user.id } });
    if (d.telegramBotToken !== existing?.telegramBotToken) {
      const verify = await verifyTelegramBot(d.telegramBotToken);
      if (!verify.success) return { error: `Telegram bot invalid: ${verify.error}` };
      telegramUsername = verify.username;
    }
  }

  await prisma.settings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      smtpHost: d.smtpHost || null,
      smtpPort: d.smtpPort ? parseInt(d.smtpPort, 10) : null,
      smtpUser: d.smtpUser || null,
      smtpPass: d.smtpPass || null,
      smtpFrom: d.smtpFrom || null,
      smtpSecure: d.smtpSecure === "on",
      smsProvider: d.smsProvider,
      twilioAccountSid: d.twilioAccountSid || null,
      twilioAuthToken: d.twilioAuthToken || null,
      twilioFromNumber: d.twilioFromNumber || null,
      vonageApiKey: d.vonageApiKey || null,
      vonageApiSecret: d.vonageApiSecret || null,
      vonageFromNumber: d.vonageFromNumber || null,
      telegramBotToken: d.telegramBotToken || null,
      telegramBotUsername: telegramUsername ?? null,
      cashfreeEnabled: d.cashfreeEnabled === "on",
      cashfreeAppId: d.cashfreeAppId || null,
      cashfreeSecretKey: d.cashfreeSecretKey || null,
      cashfreeEnvironment: d.cashfreeEnvironment,
      cashfreeWebhookSecret: d.cashfreeWebhookSecret || null,
      currency: d.currency,
      timezone: d.timezone || "UTC",
      companyName: d.companyName || null,
      companyAddress: d.companyAddress || null,
      companyEmail: d.companyEmail || null,
      companyPhone: d.companyPhone || null,
      emailEnabled: d.emailEnabled === "on",
      smsEnabled: d.smsEnabled === "on",
      telegramEnabled: d.telegramEnabled === "on",
    },
    update: {
      smtpHost: d.smtpHost || null,
      smtpPort: d.smtpPort ? parseInt(d.smtpPort, 10) : null,
      smtpUser: d.smtpUser || null,
      smtpPass: d.smtpPass || null,
      smtpFrom: d.smtpFrom || null,
      smtpSecure: d.smtpSecure === "on",
      smsProvider: d.smsProvider,
      twilioAccountSid: d.twilioAccountSid || null,
      twilioAuthToken: d.twilioAuthToken || null,
      twilioFromNumber: d.twilioFromNumber || null,
      vonageApiKey: d.vonageApiKey || null,
      vonageApiSecret: d.vonageApiSecret || null,
      vonageFromNumber: d.vonageFromNumber || null,
      telegramBotToken: d.telegramBotToken || null,
      telegramBotUsername: telegramUsername ?? undefined,
      cashfreeEnabled: d.cashfreeEnabled === "on",
      cashfreeAppId: d.cashfreeAppId || null,
      cashfreeSecretKey: d.cashfreeSecretKey || null,
      cashfreeEnvironment: d.cashfreeEnvironment,
      cashfreeWebhookSecret: d.cashfreeWebhookSecret || null,
      currency: d.currency,
      timezone: d.timezone || "UTC",
      companyName: d.companyName || null,
      companyAddress: d.companyAddress || null,
      companyEmail: d.companyEmail || null,
      companyPhone: d.companyPhone || null,
      emailEnabled: d.emailEnabled === "on",
      smsEnabled: d.smsEnabled === "on",
      telegramEnabled: d.telegramEnabled === "on",
    },
  });

  revalidatePath("/settings");
  return { telegramUsername };
}
