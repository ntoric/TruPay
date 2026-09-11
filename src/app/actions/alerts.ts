"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import type { RuleType, TriggerType } from "@prisma/client";

const ruleSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  type: z.enum(["REMINDER", "ALERT", "NOTIFICATION"]),
  triggerType: z.enum([
    "BEFORE_RENEWAL",
    "ON_RENEWAL",
    "AFTER_RENEWAL",
    "PAYMENT_DUE",
    "PAYMENT_OVERDUE",
    "SUBSCRIPTION_EXPIRED",
    "INVOICE_CREATED",
    "INVOICE_PAID",
    "CUSTOM",
  ]),
  daysOffset: z.string().optional(),
  channels: z.array(z.string()).optional(),
  subjectTemplate: z.string().max(200).optional().or(z.literal("")),
  messageTemplate: z.string().min(1, "Message template is required"),
  isActive: z.string().optional(),
});

export type RuleFormState = { error?: string } | undefined;

function parseRule(formData: FormData) {
  const channels = formData.getAll("channels").map(String);
  return ruleSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "REMINDER"),
    triggerType: String(formData.get("triggerType") ?? "BEFORE_RENEWAL"),
    daysOffset: String(formData.get("daysOffset") ?? "0"),
    channels,
    subjectTemplate: String(formData.get("subjectTemplate") ?? ""),
    messageTemplate: String(formData.get("messageTemplate") ?? ""),
    isActive: String(formData.get("isActive") ?? "on"),
  });
}

export async function createRule(
  _prev: RuleFormState,
  formData: FormData,
): Promise<RuleFormState> {
  const user = await requireUser();
  const parsed = parseRule(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  await prisma.notificationRule.create({
    data: {
      userId: user.id,
      name: d.name,
      type: d.type as RuleType,
      triggerType: d.triggerType as TriggerType,
      daysOffset: parseInt(d.daysOffset || "0", 10),
      channels: d.channels ?? [],
      subjectTemplate: d.subjectTemplate || null,
      messageTemplate: d.messageTemplate,
      isActive: d.isActive === "on",
    },
  });

  revalidatePath("/alerts");
  redirect("/alerts");
}

export async function updateRule(
  id: string,
  _prev: RuleFormState,
  formData: FormData,
): Promise<RuleFormState> {
  const user = await requireUser();
  const parsed = parseRule(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = await prisma.notificationRule.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Rule not found" };

  const d = parsed.data;
  await prisma.notificationRule.update({
    where: { id },
    data: {
      name: d.name,
      type: d.type as RuleType,
      triggerType: d.triggerType as TriggerType,
      daysOffset: parseInt(d.daysOffset || "0", 10),
      channels: d.channels ?? [],
      subjectTemplate: d.subjectTemplate || null,
      messageTemplate: d.messageTemplate,
      isActive: d.isActive === "on",
    },
  });

  revalidatePath("/alerts");
  redirect("/alerts");
}

export async function deleteRule(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.notificationRule.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Rule not found" };
  await prisma.notificationRule.delete({ where: { id } });
  revalidatePath("/alerts");
  return {};
}

export async function toggleRule(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.notificationRule.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Rule not found" };
  await prisma.notificationRule.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  revalidatePath("/alerts");
  return {};
}
