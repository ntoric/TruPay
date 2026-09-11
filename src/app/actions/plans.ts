"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import type { BillingCycle } from "@prisma/client";

const DURATIONS: Record<string, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  YEARLY: 365,
  CUSTOM: 30,
};

const planSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  price: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Invalid price"),
  billingCycle: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]),
  durationDays: z.string().optional(),
  features: z.string().optional(),
  isActive: z.string().optional(),
});

export type PlanFormState = { error?: string } | undefined;

function parsePlanData(formData: FormData) {
  const parsed = planSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    price: String(formData.get("price") ?? "0"),
    billingCycle: String(formData.get("billingCycle") ?? "MONTHLY"),
    durationDays: String(formData.get("durationDays") ?? ""),
    features: String(formData.get("features") ?? ""),
    isActive: String(formData.get("isActive") ?? "on"),
  });
  return parsed;
}

export async function createPlan(
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireUser();
  const parsed = parsePlanData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const cycle = d.billingCycle as BillingCycle;
  const duration =
    d.durationDays && d.durationDays.trim() !== ""
      ? parseInt(d.durationDays, 10)
      : DURATIONS[cycle];

  const features = d.features?.trim()
    ? d.features.split("\n").map((f) => f.trim()).filter(Boolean)
    : undefined;

  await prisma.plan.create({
    data: {
      userId: user.id,
      name: d.name,
      description: d.description || null,
      price: parseFloat(d.price),
      billingCycle: cycle,
      durationDays: duration,
      features: features ?? undefined,
      isCustom: cycle === "CUSTOM",
      isActive: d.isActive === "on",
    },
  });

  revalidatePath("/plans");
  redirect("/plans");
}

export async function updatePlan(
  id: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const user = await requireUser();
  const parsed = parsePlanData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = await prisma.plan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Plan not found" };

  const d = parsed.data;
  const cycle = d.billingCycle as BillingCycle;
  const duration =
    d.durationDays && d.durationDays.trim() !== ""
      ? parseInt(d.durationDays, 10)
      : DURATIONS[cycle];

  const features = d.features?.trim()
    ? d.features.split("\n").map((f) => f.trim()).filter(Boolean)
    : undefined;

  await prisma.plan.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      price: parseFloat(d.price),
      billingCycle: cycle,
      durationDays: duration,
      features: features ?? undefined,
      isActive: d.isActive === "on",
    },
  });

  revalidatePath("/plans");
  redirect("/plans");
}

export async function deletePlan(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.plan.findFirst({
    where: { id, userId: user.id },
    include: { _count: { select: { subscriptions: true } } },
  });
  if (!existing) return { error: "Plan not found" };
  if (existing._count.subscriptions > 0) {
    return { error: "Cannot delete a plan that is in use by subscriptions. Deactivate it instead." };
  }

  await prisma.plan.delete({ where: { id } });
  revalidatePath("/plans");
  return {};
}
