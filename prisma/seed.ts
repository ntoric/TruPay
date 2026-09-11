import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@subhub.app";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Demo user already exists. Skipping seed.");
    return;
  }

  const hashed = await bcrypt.hash("password123", 12);
  const user = await prisma.user.create({
    data: {
      name: "Demo User",
      email,
      password: hashed,
      settings: {
        create: {
          companyName: "Acme Subscriptions Inc.",
          companyEmail: "billing@acme.example",
          companyAddress: "123 Market St, San Francisco, CA",
          companyPhone: "+1 555 010 0000",
          currency: "INR",
        },
      },
    },
  });

  // Customers
  const customers = await Promise.all(
    [
      { name: "Alice Johnson", email: "alice@example.com", phone: "+15550001001", company: "Johnson LLC" },
      { name: "Bob Smith", email: "bob@example.com", phone: "+15550001002", company: "Smith & Co" },
      { name: "Carol White", email: "carol@example.com", phone: "+15550001003", company: "White Ventures" },
      { name: "Dave Lee", email: "dave@example.com", phone: "+15550001004" },
    ].map((c) =>
      prisma.customer.create({ data: { ...c, userId: user.id } }),
    ),
  );

  // Plans
  const plans = await Promise.all([
    prisma.plan.create({
      data: {
        userId: user.id,
        name: "Starter Monthly",
        description: "Basic plan for individuals",
        price: 9.99,
        billingCycle: "MONTHLY",
        durationDays: 30,
        features: ["1 user", "Email support", "5GB storage"],
      },
    }),
    prisma.plan.create({
      data: {
        userId: user.id,
        name: "Pro Monthly",
        description: "Professional plan",
        price: 29.99,
        billingCycle: "MONTHLY",
        durationDays: 30,
        features: ["10 users", "Priority support", "100GB storage", "Custom reports"],
      },
    }),
    prisma.plan.create({
      data: {
        userId: user.id,
        name: "Business Yearly",
        description: "Annual business plan with discount",
        price: 299.99,
        billingCycle: "YEARLY",
        durationDays: 365,
        features: ["Unlimited users", "24/7 support", "1TB storage", "API access"],
      },
    }),
    prisma.plan.create({
      data: {
        userId: user.id,
        name: "Custom 90-day",
        description: "Custom quarterly plan",
        price: 75.0,
        billingCycle: "CUSTOM",
        durationDays: 90,
        isCustom: true,
        features: ["Custom duration", "Dedicated manager"],
      },
    }),
  ]);

  // Products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        userId: user.id,
        name: "VPN Premium Access",
        description: "Premium VPN with global server access",
        sku: "VPN-PREMIUM",
        category: "Software",
        price: 29.99,
      },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        name: "Cloud Storage 1TB",
        description: "1TB encrypted cloud storage",
        sku: "CLOUD-1TB",
        category: "Storage",
        price: 9.99,
      },
    }),
    prisma.product.create({
      data: {
        userId: user.id,
        name: "Business Email Suite",
        description: "Professional email hosting with custom domain",
        sku: "EMAIL-BIZ",
        category: "Communication",
        price: 49.99,
      },
    }),
  ]);

  // Subscriptions
  const now = new Date();
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const subs = await Promise.all([
    prisma.subscription.create({
      data: {
        userId: user.id,
        customerId: customers[0].id,
        planId: plans[1].id,
        productId: products[0].id,
        status: "ACTIVE",
        startDate: addDays(now, -20),
        endDate: addDays(now, 10),
        autoRenew: true,
        price: 29.99,
      },
    }),
    prisma.subscription.create({
      data: {
        userId: user.id,
        customerId: customers[1].id,
        planId: plans[2].id,
        productId: products[2].id,
        status: "ACTIVE",
        startDate: addDays(now, -100),
        endDate: addDays(now, 265),
        autoRenew: true,
        price: 299.99,
      },
    }),
    prisma.subscription.create({
      data: {
        userId: user.id,
        customerId: customers[2].id,
        planId: plans[0].id,
        productId: products[1].id,
        status: "ACTIVE",
        startDate: addDays(now, -25),
        endDate: addDays(now, 5),
        autoRenew: false,
        price: 9.99,
      },
    }),
    prisma.subscription.create({
      data: {
        userId: user.id,
        customerId: customers[3].id,
        planId: plans[3].id,
        status: "EXPIRED",
        startDate: addDays(now, -100),
        endDate: addDays(now, -10),
        autoRenew: false,
        price: 75.0,
      },
    }),
  ]);

  // Default notification rules
  await Promise.all([
    prisma.notificationRule.create({
      data: {
        userId: user.id,
        name: "7-day renewal reminder",
        type: "REMINDER",
        triggerType: "BEFORE_RENEWAL",
        daysOffset: 7,
        channels: ["EMAIL"],
        subjectTemplate: "Your {{planName}} subscription renews soon",
        messageTemplate:
          "Hi {{customerName}},\n\nYour {{planName}} subscription will renew on {{subscriptionEndDate}} (in {{daysLeft}} days).\n\nThank you,\n{{companyName}}",
      },
    }),
    prisma.notificationRule.create({
      data: {
        userId: user.id,
        name: "Invoice overdue alert",
        type: "ALERT",
        triggerType: "PAYMENT_OVERDUE",
        daysOffset: 1,
        channels: ["EMAIL"],
        subjectTemplate: "Invoice {{invoiceNumber}} is overdue",
        messageTemplate:
          "Hi {{customerName}},\n\nYour invoice {{invoiceNumber}} for {{invoiceTotal}} was due on {{invoiceDueDate}} and is now overdue.\n\n{{companyName}}",
      },
    }),
  ]);

  // An invoice + payment for the first subscription
  const inv = await prisma.invoice.create({
    data: {
      userId: user.id,
      customerId: customers[0].id,
      subscriptionId: subs[0].id,
      invoiceNumber: "INV-DEMO-001",
      issueDate: addDays(now, -20),
      dueDate: addDays(now, -13),
      status: "PAID",
      subtotal: 29.99,
      total: 29.99,
      currency: "INR",
      items: {
        create: [
          {
            description: "Pro Monthly — subscription",
            quantity: 1,
            unitPrice: 29.99,
            total: 29.99,
          },
        ],
      },
    },
  });
  await prisma.payment.create({
    data: {
      userId: user.id,
      invoiceId: inv.id,
      amount: 29.99,
      method: "CARD",
      status: "COMPLETED",
      paidAt: addDays(now, -15),
    },
  });

  // An unpaid (sent) invoice
  await prisma.invoice.create({
    data: {
      userId: user.id,
      customerId: customers[2].id,
      subscriptionId: subs[2].id,
      invoiceNumber: "INV-DEMO-002",
      issueDate: addDays(now, -25),
      dueDate: addDays(now, 2),
      status: "SENT",
      subtotal: 9.99,
      total: 9.99,
      currency: "INR",
      items: {
        create: [
          {
            description: "Starter Monthly — subscription",
            quantity: 1,
            unitPrice: 9.99,
            total: 9.99,
          },
        ],
      },
    },
  });

  console.log("Seed complete!");
  console.log("Login: demo@subhub.app / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
