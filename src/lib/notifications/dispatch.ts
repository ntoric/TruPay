import { prisma } from "@/lib/prisma";
import type { Customer, Settings } from "@prisma/client";
import { sendEmail } from "@/lib/notifications/email";
import { sendSms } from "@/lib/notifications/sms";
import { sendTelegram } from "@/lib/notifications/telegram";
import { renderTemplate } from "@/lib/notifications/templates";
import type { NotificationChannel } from "@prisma/client";

export type DispatchInput = {
  userId: string;
  customer: Pick<Customer, "id" | "name" | "email" | "phone" | "telegramChatId">;
  channels: NotificationChannel[];
  subject: string;
  message: string;
  ruleId?: string;
  subscriptionId?: string;
  invoiceId?: string;
};

/**
 * Send a notification across the requested channels, logging each attempt.
 * Respects the user's master toggles in Settings.
 */
export async function dispatchNotification(input: DispatchInput): Promise<void> {
  const settings = await prisma.settings.findUnique({ where: { userId: input.userId } });
  if (!settings) return;

  const ctx = {
    customerName: input.customer.name,
    customerEmail: input.customer.email,
    companyName: settings.companyName,
  };

  const subject = renderTemplate(input.subject, ctx);
  const message = renderTemplate(input.message, ctx);

  for (const channel of input.channels) {
    // Respect master toggles
    if (channel === "EMAIL" && !settings.emailEnabled) continue;
    if (channel === "SMS" && !settings.smsEnabled) continue;
    if (channel === "TELEGRAM" && !settings.telegramEnabled) continue;

    let recipient: string | undefined;
    let status: "SENT" | "FAILED" | "SKIPPED" = "SKIPPED";
    let error: string | undefined;

    try {
      if (channel === "EMAIL") {
        if (!input.customer.email) {
          status = "SKIPPED";
        } else {
          recipient = input.customer.email;
          const res = await sendEmail(settings, recipient, subject, message);
          status = res.success ? "SENT" : "FAILED";
          error = res.error;
        }
      } else if (channel === "SMS") {
        if (!input.customer.phone) {
          status = "SKIPPED";
        } else {
          recipient = input.customer.phone;
          const res = await sendSms(settings, recipient, message);
          status = res.success ? "SENT" : "FAILED";
          error = res.error;
        }
      } else if (channel === "TELEGRAM") {
        if (!input.customer.telegramChatId) {
          status = "SKIPPED";
        } else {
          recipient = input.customer.telegramChatId;
          const res = await sendTelegram(settings, recipient, message);
          status = res.success ? "SENT" : "FAILED";
          error = res.error;
        }
      }
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message : String(err);
    }

    await prisma.notificationLog.create({
      data: {
        userId: input.userId,
        ruleId: input.ruleId ?? null,
        customerId: input.customer.id,
        subscriptionId: input.subscriptionId,
        invoiceId: input.invoiceId,
        channel,
        status,
        recipient,
        subject,
        message,
        error,
        sentAt: status === "SENT" ? new Date() : null,
      },
    });
  }
}

/** Parse a rule's channels string array into NotificationChannel enum values. */
export function parseChannels(channels: string[]): NotificationChannel[] {
  return channels.filter((c): c is NotificationChannel =>
    ["EMAIL", "SMS", "TELEGRAM"].includes(c),
  ) as NotificationChannel[];
}

/** Convenience: send a one-off notification using a rule's configuration. */
export async function dispatchViaRule(
  rule: {
    id: string;
    userId: string;
    channels: string[];
    subjectTemplate: string | null;
    messageTemplate: string;
  },
  customer: Pick<Customer, "id" | "name" | "email" | "phone" | "telegramChatId">,
  extraCtx: Record<string, string | number | undefined>,
  opts: { subscriptionId?: string; invoiceId?: string } = {},
): Promise<void> {
  const channels = parseChannels(rule.channels);
  if (channels.length === 0) return;
  const subject = rule.subjectTemplate
    ? renderTemplate(rule.subjectTemplate, extraCtx)
    : "Notification";
  const message = renderTemplate(rule.messageTemplate, extraCtx);

  await dispatchNotification({
    userId: rule.userId,
    customer,
    channels,
    subject,
    message,
    ruleId: rule.id,
    subscriptionId: opts.subscriptionId,
    invoiceId: opts.invoiceId,
  });
}
