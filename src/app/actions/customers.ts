"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  telegramChatId: z.string().max(40).optional().or(z.literal("")),
  company: z.string().max(120).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type CustomerFormState = { error?: string } | undefined;

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireUser();

  const parsed = customerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    telegramChatId: String(formData.get("telegramChatId") ?? ""),
    company: String(formData.get("company") ?? ""),
    address: String(formData.get("address") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      telegramChatId: d.telegramChatId || null,
      company: d.company || null,
      address: d.address || null,
      notes: d.notes || null,
    },
  });

  await dispatchWebhookEvent(user.id, "customer.created", customer);
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(
  id: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireUser();

  const parsed = customerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    telegramChatId: String(formData.get("telegramChatId") ?? ""),
    company: String(formData.get("company") ?? ""),
    address: String(formData.get("address") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // ownership check
  const existing = await prisma.customer.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Customer not found" };

  const d = parsed.data;
  await prisma.customer.update({
    where: { id },
    data: {
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      telegramChatId: d.telegramChatId || null,
      company: d.company || null,
      address: d.address || null,
      notes: d.notes || null,
    },
  });

  await dispatchWebhookEvent(user.id, "customer.updated", { id, ...d });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.customer.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Customer not found" };

  await prisma.customer.delete({ where: { id } });
  await dispatchWebhookEvent(user.id, "customer.deleted", { id });
  revalidatePath("/customers");
  return {};
}
