"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, getOrCreateSettings } from "@/lib/session";
import { z } from "zod";
import type { InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { addDays, generateInvoiceNumber } from "@/lib/utils";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { dispatchWebhookEvent } from "@/lib/webhooks/dispatch";

// ---- Create / Update ----

type ItemInput = { description: string; quantity: string; unitPrice: string };

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  subscriptionId: z.string().optional().or(z.literal("")),
  issueDate: z.string().min(1, "Issue date required"),
  dueDate: z.string().min(1, "Due date required"),
  status: z.enum(["DRAFT", "SENT", "PAID", "PARTIAL", "OVERDUE", "CANCELLED"]),
  taxRate: z.string().optional(),
  discount: z.string().optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
  items: z.string(), // JSON-encoded array of ItemInput
});

export type InvoiceFormState = { error?: string } | undefined;

function computeTotals(items: ItemInput[], taxRate: number, discount: number) {
  const subtotal = items.reduce(
    (sum, it) => sum + (parseFloat(it.quantity || "0") * parseFloat(it.unitPrice || "0")),
    0,
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = Math.max(0, subtotal + taxAmount - discount);
  return { subtotal, taxAmount, total };
}

export async function createInvoice(
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const user = await requireUser();
  const settings = await getOrCreateSettings(user.id);

  const parsed = invoiceSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    subscriptionId: String(formData.get("subscriptionId") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    taxRate: String(formData.get("taxRate") ?? "0"),
    discount: String(formData.get("discount") ?? "0"),
    notes: String(formData.get("notes") ?? ""),
    items: String(formData.get("items") ?? "[]"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: user.id } });
  if (!customer) return { error: "Customer not found" };

  let items: ItemInput[] = [];
  try {
    items = JSON.parse(d.items);
  } catch {
    return { error: "Invalid line items" };
  }
  if (items.length === 0) return { error: "Add at least one line item" };

  const taxRate = parseFloat(d.taxRate || "0") || 0;
  const discount = parseFloat(d.discount || "0") || 0;
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate, discount);

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      customerId: customer.id,
      subscriptionId: d.subscriptionId || null,
      invoiceNumber: generateInvoiceNumber(),
      issueDate: new Date(d.issueDate),
      dueDate: new Date(d.dueDate),
      status: d.status as InvoiceStatus,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      currency: settings.currency,
      notes: d.notes || null,
      items: {
        create: items.map((it) => ({
          description: it.description,
          quantity: parseFloat(it.quantity || "1"),
          unitPrice: parseFloat(it.unitPrice || "0"),
          total: parseFloat(it.quantity || "1") * parseFloat(it.unitPrice || "0"),
        })),
      },
    },
  });

  await dispatchWebhookEvent(user.id, "invoice.created", {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: customer.id,
    subscriptionId: invoice.subscriptionId,
    status: invoice.status,
    total: Number(invoice.total),
    currency: invoice.currency,
  });
  revalidatePath("/invoices");
  redirect(`/invoices/${invoice.id}`);
}

export async function updateInvoice(
  id: string,
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const user = await requireUser();
  const existing = await prisma.invoice.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Invoice not found" };

  const parsed = invoiceSchema.safeParse({
    customerId: String(formData.get("customerId") ?? ""),
    subscriptionId: String(formData.get("subscriptionId") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    status: String(formData.get("status") ?? "DRAFT"),
    taxRate: String(formData.get("taxRate") ?? "0"),
    discount: String(formData.get("discount") ?? "0"),
    notes: String(formData.get("notes") ?? ""),
    items: String(formData.get("items") ?? "[]"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const customer = await prisma.customer.findFirst({ where: { id: d.customerId, userId: user.id } });
  if (!customer) return { error: "Customer not found" };

  let items: ItemInput[] = [];
  try {
    items = JSON.parse(d.items);
  } catch {
    return { error: "Invalid line items" };
  }
  if (items.length === 0) return { error: "Add at least one line item" };

  const taxRate = parseFloat(d.taxRate || "0") || 0;
  const discount = parseFloat(d.discount || "0") || 0;
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate, discount);

  await prisma.invoice.update({
    where: { id },
    data: {
      customerId: customer.id,
      subscriptionId: d.subscriptionId || null,
      issueDate: new Date(d.issueDate),
      dueDate: new Date(d.dueDate),
      status: d.status as InvoiceStatus,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      total,
      notes: d.notes || null,
    },
  });

  // Replace items
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
  await prisma.invoiceItem.createMany({
    data: items.map((it) => ({
      invoiceId: id,
      description: it.description,
      quantity: parseFloat(it.quantity || "1"),
      unitPrice: parseFloat(it.unitPrice || "0"),
      total: parseFloat(it.quantity || "1") * parseFloat(it.unitPrice || "0"),
    })),
  });

  await dispatchWebhookEvent(user.id, "invoice.updated", {
    id,
    customerId: customer.id,
    status: d.status,
    total,
  });
  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

export async function deleteInvoice(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.invoice.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Invoice not found" };
  await prisma.invoice.delete({ where: { id } });
  await dispatchWebhookEvent(user.id, "invoice.deleted", { id });
  revalidatePath("/invoices");
  return {};
}

// ---- Payments ----

export async function recordPayment(
  id: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const user = await requireUser();
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { payments: true, customer: true },
  });
  if (!invoice) return { error: "Invoice not found" };

  const amount = parseFloat(String(formData.get("amount") ?? "0"));
  const method = String(formData.get("method") ?? "OTHER") as PaymentMethod;
  const transactionId = String(formData.get("transactionId") ?? "") || null;
  const notes = String(formData.get("notes") ?? "") || null;

  if (isNaN(amount) || amount <= 0) return { error: "Enter a valid amount" };

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      invoiceId: id,
      amount,
      method,
      status: "COMPLETED" as PaymentStatus,
      transactionId,
      notes,
      paidAt: new Date(),
    },
  });

  // Update invoice status based on total paid
  const totalPaid =
    invoice.payments.reduce((s, p) => s + (p.status === "COMPLETED" ? Number(p.amount) : 0), 0) +
    amount;
  const newStatus: InvoiceStatus =
    totalPaid >= Number(invoice.total) ? "PAID" : "PARTIAL";
  await prisma.invoice.update({ where: { id }, data: { status: newStatus } });

  // Outbound webhook: payment recorded
  await dispatchWebhookEvent(user.id, "payment.recorded", {
    id: payment.id,
    invoiceId: id,
    amount: Number(payment.amount),
    method: payment.method,
    status: payment.status,
    invoiceStatus: newStatus,
  });

  // If fully paid, fire INVOICE_PAID event-driven notifications + webhook
  if (newStatus === "PAID") {
    await dispatchWebhookEvent(user.id, "invoice.paid", {
      id,
      invoiceNumber: invoice.invoiceNumber,
      total: Number(invoice.total),
      totalPaid,
    });
    const rules = await prisma.notificationRule.findMany({
      where: { userId: user.id, triggerType: "INVOICE_PAID", isActive: true },
    });
    for (const rule of rules) {
      const channels = rule.channels.filter((c): c is "EMAIL" | "SMS" | "TELEGRAM" =>
        ["EMAIL", "SMS", "TELEGRAM"].includes(c),
      ) as ("EMAIL" | "SMS" | "TELEGRAM")[];
      if (channels.length === 0) continue;
      await dispatchNotification({
        userId: user.id,
        customer: invoice.customer,
        channels,
        subject: rule.subjectTemplate ?? "Payment received",
        message: rule.messageTemplate,
        ruleId: rule.id,
        invoiceId: id,
      });
    }
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/payments");
  return {};
}

// ---- Send invoice via email ----

export async function sendInvoiceEmail(id: string): Promise<{ error?: string; sent?: boolean }> {
  const user = await requireUser();
  const invoice = await prisma.invoice.findFirst({
    where: { id, userId: user.id },
    include: { customer: true, items: true },
  });
  if (!invoice) return { error: "Invoice not found" };
  if (!invoice.customer.email) return { error: "Customer has no email address" };

  const settings = await getOrCreateSettings(user.id);
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const subject = `Invoice ${invoice.invoiceNumber} from ${settings.companyName ?? "SubHub"}`;
  const message = `Hi ${invoice.customer.name},\n\nYour invoice ${invoice.invoiceNumber} for ${invoice.total} ${invoice.currency} is now available.\nDue date: ${invoice.dueDate.toDateString()}\n\nView it here: ${baseUrl}/invoices/${invoice.id}\n\nThank you,\n${settings.companyName ?? ""}`;

  await dispatchNotification({
    userId: user.id,
    customer: invoice.customer,
    channels: ["EMAIL"],
    subject,
    message,
    invoiceId: id,
  });

  if (invoice.status === "DRAFT") {
    await prisma.invoice.update({ where: { id }, data: { status: "SENT" } });
  }

  await dispatchWebhookEvent(user.id, "invoice.sent", {
    id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    sentTo: invoice.customer.email ?? null,
  });
  revalidatePath(`/invoices/${id}`);
  return { sent: true };
}
