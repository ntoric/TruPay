"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import type { SubscriptionStatus } from "@prisma/client";
import { addDays, generateInvoiceNumber } from "@/lib/utils";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

const subSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  planId: z.string().min(1, "Select a plan"),
  productId: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "PENDING", "EXPIRED", "CANCELLED", "PAST_DUE", "TRIALING"]),
  startDate: z.string().min(1, "Start date is required"),
  durationDays: z.string().optional(),
  price: z.string().optional(),
  autoRenew: z.string().optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  createInvoice: z.string().optional(),
});

export type SubFormState = { error?: string } | undefined;

export async function createSubscription(
  _prev: SubFormState,
  formData: FormData,
): Promise<SubFormState> {
  const user = await requireUser();
  const parsed = subSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    planId: String(formData.get("planId") ?? ""),
    productId: String(formData.get("productId") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
    startDate: String(formData.get("startDate") ?? ""),
    durationDays: String(formData.get("durationDays") ?? ""),
    price: String(formData.get("price") ?? ""),
    autoRenew: String(formData.get("autoRenew") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    createInvoice: String(formData.get("createInvoice") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const plan = await prisma.plan.findFirst({ where: { id: d.planId, userId: user.id } });
  if (!plan) return { error: "Plan not found" };
  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: user.id } });
  if (!customer) return { error: "Customer not found" };

  // Validate product ownership if provided
  let productId: string | null = null;
  let productName: string | null = null;
  if (d.productId) {
    const product = await prisma.product.findFirst({ where: { id: d.productId, userId: user.id } });
    if (!product) return { error: "Product not found" };
    productId = product.id;
    productName = product.name;
  }

  const duration =
    d.durationDays && d.durationDays.trim() !== ""
      ? parseInt(d.durationDays, 10)
      : plan.durationDays;
  const price =
    d.price && d.price.trim() !== ""
      ? parseFloat(d.price)
      : Number(plan.price);

  const startDate = new Date(d.startDate);
  const endDate = addDays(startDate, duration);

  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      customerId: customer.id,
      planId: plan.id,
      productId,
      status: d.status as SubscriptionStatus,
      startDate,
      endDate,
      autoRenew: d.autoRenew === "on",
      price,
      notes: d.notes || null,
    },
  });

  // Optionally generate the first invoice
  if (d.createInvoice === "on") {
    const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
    const subtotal = price;
    const taxRate = 0;
    const taxAmount = 0;
    const total = subtotal + taxAmount;
    const invoice = await prisma.invoice.create({
      data: {
        userId: user.id,
        customerId: customer.id,
        subscriptionId: subscription.id,
        invoiceNumber: generateInvoiceNumber(),
        issueDate: new Date(),
        dueDate: addDays(new Date(), 7),
        status: "SENT",
        subtotal,
        taxRate,
        taxAmount,
        discount: 0,
        total,
        currency: settings?.currency ?? "INR",
        items: {
          create: [
            {
              description: `${plan.name} — ${plan.billingCycle} subscription${productName ? ` (${productName})` : ""}`,
              quantity: 1,
              unitPrice: price,
              total: price,
            },
          ],
        },
      },
    });
    await dispatchWebhookEvent(user.id, "invoice.created", {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subscriptionId: subscription.id,
      customerId: customer.id,
      total: Number(invoice.total),
      status: invoice.status,
    });
  }

  await dispatchWebhookEvent(user.id, "subscription.created", {
    ...subscription,
    price: Number(subscription.price),
  });
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function updateSubscription(
  id: string,
  _prev: SubFormState,
  formData: FormData,
): Promise<SubFormState> {
  const user = await requireUser();
  const parsed = subSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    planId: String(formData.get("planId") ?? ""),
    productId: String(formData.get("productId") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
    startDate: String(formData.get("startDate") ?? ""),
    durationDays: String(formData.get("durationDays") ?? ""),
    price: String(formData.get("price") ?? ""),
    autoRenew: String(formData.get("autoRenew") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    createInvoice: String(formData.get("createInvoice") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const existing = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Subscription not found" };

  const d = parsed.data;
  const plan = await prisma.plan.findFirst({ where: { id: d.planId, userId: user.id } });
  if (!plan) return { error: "Plan not found" };
  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: user.id } });
  if (!customer) return { error: "Customer not found" };

  // Validate product ownership if provided
  let productId: string | null = null;
  if (d.productId) {
    const product = await prisma.product.findFirst({ where: { id: d.productId, userId: user.id } });
    if (!product) return { error: "Product not found" };
    productId = product.id;
  }

  const duration =
    d.durationDays && d.durationDays.trim() !== ""
      ? parseInt(d.durationDays, 10)
      : plan.durationDays;
  const price =
    d.price && d.price.trim() !== ""
      ? parseFloat(d.price)
      : Number(plan.price);

  const startDate = new Date(d.startDate);
  const endDate = addDays(startDate, duration);

  await prisma.subscription.update({
    where: { id },
    data: {
      customerId: customer.id,
      planId: plan.id,
      productId,
      status: d.status as SubscriptionStatus,
      startDate,
      endDate,
      autoRenew: d.autoRenew === "on",
      price,
      notes: d.notes || null,
    },
  });

  await dispatchWebhookEvent(user.id, "subscription.updated", {
    id,
    customerId: customer.id,
    planId: plan.id,
    productId,
    status: d.status,
    startDate,
    endDate,
    autoRenew: d.autoRenew === "on",
    price,
  });
  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function deleteSubscription(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Subscription not found" };

  await prisma.subscription.delete({ where: { id } });
  await dispatchWebhookEvent(user.id, "subscription.deleted", { id });
  revalidatePath("/subscriptions");
  return {};
}

/** Renew a subscription: extend endDate by one plan cycle. */
export async function renewSubscription(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const sub = await prisma.subscription.findFirst({
    where: { id, userId: user.id },
    include: { plan: true },
  });
  if (!sub) return { error: "Subscription not found" };

  const newStart = sub.endDate > new Date() ? sub.endDate : new Date();
  const newEnd = addDays(newStart, sub.plan.durationDays);

  await prisma.subscription.update({
    where: { id },
    data: {
      startDate: newStart,
      endDate: newEnd,
      status: "ACTIVE",
    },
  });

  await dispatchWebhookEvent(user.id, "subscription.renewed", {
    id,
    startDate: newStart,
    endDate: newEnd,
    status: "ACTIVE",
  });
  revalidatePath("/subscriptions");
  return {};
}
