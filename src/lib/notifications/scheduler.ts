import { prisma } from "@/lib/prisma";
import { dispatchViaRule } from "@/lib/notifications/dispatch";
import { renderTemplate, DEFAULT_TEMPLATES } from "@/lib/notifications/templates";
import { formatCurrency, formatDate, daysUntil } from "@/lib/utils";
import type { TriggerType } from "@prisma/client";

/**
 * Process all active notification rules for all users.
 * Called by the cron endpoint. Returns a summary of dispatched notifications.
 */
export async function processScheduledNotifications(): Promise<{
  processed: number;
  dispatched: number;
}> {
  const rules = await prisma.notificationRule.findMany({
    where: { isActive: true },
    include: { user: { include: { settings: true } } },
  });

  let dispatched = 0;

  for (const rule of rules) {
    const settings = rule.user.settings;
    if (!settings) continue;

    try {
      const count = await processRule(rule, settings.currency ?? "INR");
      dispatched += count;
    } catch (err) {
      console.error(`[scheduler] Error processing rule ${rule.id}:`, err);
    }
  }

  return { processed: rules.length, dispatched };
}

async function processRule(
  rule: {
    id: string;
    userId: string;
    triggerType: TriggerType;
    daysOffset: number;
    channels: string[];
    subjectTemplate: string | null;
    messageTemplate: string;
  },
  currency: string,
): Promise<number> {
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setDate(targetDate.getDate() + rule.daysOffset);
  // match the calendar day (ignore time)
  const targetDay = targetDate.toISOString().slice(0, 10);

  let count = 0;

  switch (rule.triggerType) {
    case "BEFORE_RENEWAL": {
      // subscriptions ending on (today + daysOffset)
      const subs = await prisma.subscription.findMany({
        where: {
          userId: rule.userId,
          status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
        },
        include: { customer: true, plan: true },
      });
      for (const s of subs) {
        const endDay = s.endDate.toISOString().slice(0, 10);
        if (endDay === targetDay) {
          await dispatchViaRule(
            rule,
            s.customer,
            {
              customerName: s.customer.name,
              planName: s.plan.name,
              subscriptionEndDate: formatDate(s.endDate),
              daysLeft: Math.max(0, daysUntil(s.endDate)),
            },
            { subscriptionId: s.id },
          );
          count++;
        }
      }
      break;
    }

    case "SUBSCRIPTION_EXPIRED":
    case "AFTER_RENEWAL": {
      const offset = rule.daysOffset;
      const subs = await prisma.subscription.findMany({
        where: { userId: rule.userId, status: { in: ["ACTIVE", "EXPIRED", "PAST_DUE"] } },
        include: { customer: true, plan: true },
      });
      for (const s of subs) {
        const expiredDay = s.endDate.toISOString().slice(0, 10);
        const triggerDay = new Date(s.endDate);
        triggerDay.setDate(triggerDay.getDate() + offset);
        if (triggerDay.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
          await dispatchViaRule(
            rule,
            s.customer,
            {
              customerName: s.customer.name,
              planName: s.plan.name,
              subscriptionEndDate: formatDate(s.endDate),
              daysLeft: daysUntil(s.endDate),
            },
            { subscriptionId: s.id },
          );
          count++;
        }
      }
      break;
    }

    case "PAYMENT_DUE": {
      // invoices due on (today + daysOffset)
      const invoices = await prisma.invoice.findMany({
        where: {
          userId: rule.userId,
          status: { in: ["SENT", "PARTIAL"] },
        },
        include: { customer: true, items: true },
      });
      for (const inv of invoices) {
        const dueDay = inv.dueDate.toISOString().slice(0, 10);
        const triggerDay = new Date(inv.dueDate);
        triggerDay.setDate(triggerDay.getDate() - rule.daysOffset);
        if (triggerDay.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
          await dispatchViaRule(
            rule,
            inv.customer,
            {
              customerName: inv.customer.name,
              invoiceNumber: inv.invoiceNumber,
              invoiceTotal: formatCurrency(inv.total, currency),
              invoiceDueDate: formatDate(inv.dueDate),
            },
            { invoiceId: inv.id },
          );
          count++;
        }
        void dueDay;
      }
      break;
    }

    case "PAYMENT_OVERDUE": {
      const invoices = await prisma.invoice.findMany({
        where: { userId: rule.userId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
        include: { customer: true },
      });
      for (const inv of invoices) {
        const overdueDay = new Date(inv.dueDate);
        overdueDay.setDate(overdueDay.getDate() + rule.daysOffset);
        if (overdueDay.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)) {
          await dispatchViaRule(
            rule,
            inv.customer,
            {
              customerName: inv.customer.name,
              invoiceNumber: inv.invoiceNumber,
              invoiceTotal: formatCurrency(inv.total, currency),
              invoiceDueDate: formatDate(inv.dueDate),
            },
            { invoiceId: inv.id },
          );
          count++;
        }
      }
      break;
    }

    default:
      // INVOICE_CREATED, INVOICE_PAID, ON_RENEWAL, CUSTOM are event-driven, not scheduled
      break;
  }

  return count;
}

export { DEFAULT_TEMPLATES, renderTemplate };
