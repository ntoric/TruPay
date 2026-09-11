import { NextRequest, NextResponse } from "next/server";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, errorResponse } from "@/lib/mobile-auth";
import { toCSV } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);

  const [
    account,
    settings,
    customers,
    products,
    plans,
    subscriptions,
    invoices,
    invoiceItems,
    payments,
    notificationRules,
    notificationLogs,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    }),
    prisma.settings.findUnique({ where: { userId: user.id } }),
    prisma.customer.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.product.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.plan.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true } }, plan: { select: { name: true } }, product: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true } }, subscription: { select: { id: true } } },
    }),
    prisma.invoiceItem.findMany({
      where: { invoice: { userId: user.id } },
      include: { invoice: { select: { invoiceNumber: true } } },
      orderBy: { invoice: { createdAt: "desc" } },
    }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { paidAt: "desc" },
      include: { invoice: { select: { invoiceNumber: true } } },
    }),
    prisma.notificationRule.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.notificationLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 1000 }),
  ]);

  const csvFiles: { name: string; content: string }[] = [];
  csvFiles.push({ name: "account.csv", content: toCSV(account ? [account] : []) });

  if (settings) {
    const safeSettings = {
      id: settings.id,
      userId: settings.userId,
      currency: settings.currency,
      timezone: settings.timezone,
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      smtpSecure: settings.smtpSecure,
      smsProvider: settings.smsProvider,
      twilioFromNumber: settings.twilioFromNumber,
      vonageFromNumber: settings.vonageFromNumber,
      telegramBotUsername: settings.telegramBotUsername,
      emailEnabled: settings.emailEnabled,
      smsEnabled: settings.smsEnabled,
      telegramEnabled: settings.telegramEnabled,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
    csvFiles.push({ name: "settings.csv", content: toCSV([safeSettings]) });
  }

  csvFiles.push({
    name: "customers.csv",
    content: toCSV(customers.map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone,
      telegramChatId: c.telegramChatId, company: c.company, address: c.address,
      notes: c.notes, createdAt: c.createdAt, updatedAt: c.updatedAt,
    }))),
  });

  csvFiles.push({
    name: "products.csv",
    content: toCSV(products.map((p) => ({
      id: p.id, name: p.name, description: p.description, sku: p.sku,
      category: p.category, price: p.price, isActive: p.isActive,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    }))),
  });

  csvFiles.push({
    name: "plans.csv",
    content: toCSV(plans.map((p) => ({
      id: p.id, name: p.name, description: p.description, price: p.price,
      billingCycle: p.billingCycle, durationDays: p.durationDays, isCustom: p.isCustom,
      isActive: p.isActive, features: p.features ? JSON.stringify(p.features) : "",
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    }))),
  });

  csvFiles.push({
    name: "subscriptions.csv",
    content: toCSV(subscriptions.map((s) => ({
      id: s.id, customer: s.customer.name, plan: s.plan.name,
      product: s.product?.name ?? "", status: s.status, startDate: s.startDate,
      endDate: s.endDate, autoRenew: s.autoRenew, price: s.price, notes: s.notes,
      createdAt: s.createdAt, updatedAt: s.updatedAt,
    }))),
  });

  csvFiles.push({
    name: "invoices.csv",
    content: toCSV(invoices.map((i) => ({
      id: i.id, invoiceNumber: i.invoiceNumber, customer: i.customer.name,
      subscriptionId: i.subscriptionId, issueDate: i.issueDate, dueDate: i.dueDate,
      status: i.status, subtotal: i.subtotal, taxRate: i.taxRate, taxAmount: i.taxAmount,
      discount: i.discount, total: i.total, currency: i.currency, notes: i.notes,
      createdAt: i.createdAt, updatedAt: i.updatedAt,
    }))),
  });

  csvFiles.push({
    name: "invoice_items.csv",
    content: toCSV(invoiceItems.map((it) => ({
      id: it.id, invoiceNumber: it.invoice.invoiceNumber, description: it.description,
      quantity: it.quantity, unitPrice: it.unitPrice, total: it.total,
    }))),
  });

  csvFiles.push({
    name: "payments.csv",
    content: toCSV(payments.map((p) => ({
      id: p.id, invoiceNumber: p.invoice.invoiceNumber, amount: p.amount,
      method: p.method, status: p.status, transactionId: p.transactionId,
      paidAt: p.paidAt, notes: p.notes, createdAt: p.createdAt,
    }))),
  });

  csvFiles.push({
    name: "notification_rules.csv",
    content: toCSV(notificationRules.map((r) => ({
      id: r.id, name: r.name, type: r.type, triggerType: r.triggerType,
      daysOffset: r.daysOffset, channels: r.channels.join(";"),
      subjectTemplate: r.subjectTemplate, messageTemplate: r.messageTemplate,
      isActive: r.isActive, createdAt: r.createdAt, updatedAt: r.updatedAt,
    }))),
  });

  csvFiles.push({
    name: "notification_logs.csv",
    content: toCSV(notificationLogs.map((l) => ({
      id: l.id, ruleId: l.ruleId, customerId: l.customerId, subscriptionId: l.subscriptionId,
      invoiceId: l.invoiceId, channel: l.channel, status: l.status, recipient: l.recipient,
      subject: l.subject, message: l.message, error: l.error, sentAt: l.sentAt,
      createdAt: l.createdAt,
    }))),
  });

  const archive = new ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));
  const zipBuffer: Promise<Buffer> = new Promise((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  for (const file of csvFiles) {
    archive.append(file.content, { name: file.name });
  }

  const readme = `SubHub Account Data Export
===========================
User: ${account?.email}
Exported: ${new Date().toISOString()}

Files included:
${csvFiles.map((f) => `  - ${f.name}`).join("\n")}

This archive contains all your account data in CSV format.
`;
  archive.append(readme, { name: "README.txt" });

  await archive.finalize();
  const buf = await zipBuffer;

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `subhub-export-${dateStr}.zip`;
  const zipData = new Uint8Array(buf);

  return new NextResponse(zipData, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipData.byteLength),
    },
  });
}
