type TemplateContext = {
  customerName?: string;
  customerEmail?: string | null;
  planName?: string;
  subscriptionEndDate?: string;
  daysLeft?: number;
  invoiceNumber?: string;
  invoiceTotal?: string;
  invoiceDueDate?: string;
  companyName?: string | null;
  [key: string]: string | number | undefined | null;
};

/** Render a template string by replacing {{key}} placeholders. */
export function renderTemplate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key: string) => {
    const val = ctx[key];
    return val === undefined || val === null ? "" : String(val);
  });
}

export const DEFAULT_TEMPLATES = {
  renewalReminder: {
    subject: "Your subscription renews soon",
    message:
      "Hi {{customerName}},\n\nThis is a reminder that your {{planName}} subscription will renew on {{subscriptionEndDate}} (in {{daysLeft}} days).\n\nThank you,\n{{companyName}}",
  },
  paymentDue: {
    subject: "Invoice {{invoiceNumber}} is due",
    message:
      "Hi {{customerName}},\n\nYour invoice {{invoiceNumber}} for {{invoiceTotal}} is due on {{invoiceDueDate}}.\n\nThank you,\n{{companyName}}",
  },
  paymentOverdue: {
    subject: "Invoice {{invoiceNumber}} is overdue",
    message:
      "Hi {{customerName}},\n\nYour invoice {{invoiceNumber}} for {{invoiceTotal}} was due on {{invoiceDueDate}} and is now overdue. Please complete payment as soon as possible.\n\n{{companyName}}",
  },
  subscriptionExpired: {
    subject: "Your subscription has expired",
    message:
      "Hi {{customerName}},\n\nYour {{planName}} subscription expired on {{subscriptionEndDate}}. Reply to renew.\n\n{{companyName}}",
  },
};
