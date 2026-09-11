import { prisma } from "@/lib/prisma";
import type { CashfreeConfig } from "./cashfree";

/**
 * Load Cashfree configuration from the user's settings.
 * Returns null if Cashfree is not enabled or not configured.
 */
export async function getCashfreeConfig(
  userId: string,
): Promise<CashfreeConfig | null> {
  const settings = await prisma.settings.findUnique({
    where: { userId },
    select: {
      cashfreeEnabled: true,
      cashfreeAppId: true,
      cashfreeSecretKey: true,
      cashfreeEnvironment: true,
      cashfreeWebhookSecret: true,
    },
  });

  if (!settings?.cashfreeEnabled) return null;
  if (!settings.cashfreeAppId || !settings.cashfreeSecretKey) return null;

  return {
    appId: settings.cashfreeAppId,
    secretKey: settings.cashfreeSecretKey,
    environment:
      settings.cashfreeEnvironment === "production"
        ? "production"
        : "sandbox",
    webhookSecret: settings.cashfreeWebhookSecret || undefined,
  };
}

export type { CashfreeConfig };
