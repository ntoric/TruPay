"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import { WEBHOOK_EVENTS, isValidEvent } from "@/lib/webhooks/events";

const createSchema = z.object({
  url: z
    .string()
    .url("Enter a valid https URL")
    .refine((v) => v.startsWith("https://"), "Webhook URL must use https"),
  events: z.string().optional(), // comma-separated event names, or "" for all
});

export type WebhookFormState = { error?: string; secret?: string; id?: string } | undefined;

/** Parse a comma/newline-separated event list into a validated array. */
function parseEvents(raw: string | undefined): { events: string[]; error?: string } {
  if (!raw || raw.trim() === "") return { events: [] }; // empty = all events
  const tokens = raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const invalid = tokens.filter((t) => !isValidEvent(t));
  if (invalid.length > 0) {
    return { events: [], error: `Unknown event(s): ${invalid.join(", ")}` };
  }
  return { events: tokens };
}

/** Create a webhook endpoint. The signing secret is returned once. */
export async function createWebhook(
  _prev: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    url: String(formData.get("url") ?? ""),
    events: String(formData.get("events") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { events, error } = parseEvents(parsed.data.events);
  if (error) return { error };

  const secret = "whsec_" + randomBytes(24).toString("hex");
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      userId: user.id,
      url: parsed.data.url,
      events,
      secret,
      isActive: true,
    },
  });

  revalidatePath("/settings");
  return { secret, id: endpoint.id };
}

const updateSchema = z.object({
  url: z
    .string()
    .url("Enter a valid https URL")
    .refine((v) => v.startsWith("https://"), "Webhook URL must use https"),
  events: z.string().optional(),
  isActive: z.string().optional(),
});

/** Update a webhook endpoint's URL, events, and active state. */
export async function updateWebhook(
  id: string,
  _prev: WebhookFormState,
  formData: FormData,
): Promise<WebhookFormState> {
  const user = await requireUser();
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Webhook not found" };

  const parsed = updateSchema.safeParse({
    url: String(formData.get("url") ?? ""),
    events: String(formData.get("events") ?? ""),
    isActive: String(formData.get("isActive") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { events, error } = parseEvents(parsed.data.events);
  if (error) return { error };

  await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      url: parsed.data.url,
      events,
      isActive: parsed.data.isActive === "on",
    },
  });

  revalidatePath("/settings");
  return {};
}

/** Toggle a webhook endpoint's active state. */
export async function toggleWebhook(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Webhook not found" };

  await prisma.webhookEndpoint.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/settings");
  return {};
}

/** Delete a webhook endpoint (cascades to delivery logs). */
export async function deleteWebhook(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Webhook not found" };

  await prisma.webhookEndpoint.delete({ where: { id } });
  revalidatePath("/settings");
  return {};
}

/** Re-deliver a previously recorded webhook delivery. */
export async function retryWebhookDelivery(
  deliveryId: string,
): Promise<{ error?: string }> {
  const user = await requireUser();
  const { redeliverWebhook } = await import("@/lib/webhooks/dispatch");
  const result = await redeliverWebhook(deliveryId, user.id);
  if (result.error) return result;
  revalidatePath("/settings");
  return {};
}

export { WEBHOOK_EVENTS };
