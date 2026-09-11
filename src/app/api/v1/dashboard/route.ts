import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromApiKey, apiJson, apiError } from "@/lib/api-auth";
import { titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/v1/dashboard — high-level account summary for external dashboards. */
export async function GET(req: NextRequest) {
  const user = await getUserFromApiKey(req.headers.get("authorization"));
  if (!user) return apiError("Unauthorized — provide a valid API key", 401);
  const uid = user.id;

  const settings = await prisma.settings.findUnique({ where: { userId: uid } });
  const currency = settings?.currency ?? "INR";

  const [totalCustomers, activeSubscriptions, invoices, expiringSubs, overdueInvoices] =
    await Promise.all([
      prisma.customer.count({ where: { userId: uid } }),
      prisma.subscription.count({ where: { userId: uid, status: "ACTIVE" } }),
      prisma.invoice.findMany({
        where: { userId: uid, status: { in: ["PAID", "PARTIAL"] } },
        select: { total: true, payments: { select: { amount: true, paidAt: true, status: true } } },
      }),
      prisma.subscription.count({
        where: {
          userId: uid,
          status: "ACTIVE",
          endDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.invoice.count({ where: { userId: uid, status: "OVERDUE" } }),
    ]);

  const activeSubRows = await prisma.subscription.findMany({
    where: { userId: uid, status: "ACTIVE" },
    include: { plan: true },
  });
  const mrr = activeSubRows.reduce((sum, s) => {
    const days = s.plan.durationDays || 30;
    return sum + (Number(s.price) / days) * 30;
  }, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const totalRevenue = invoices.reduce((sum, inv) => {
    const payments = inv.payments.filter((p) => p.status === "COMPLETED" && p.paidAt >= monthStart);
    return sum + payments.reduce((s, p) => s + Number(p.amount), 0);
  }, 0);

  const monthlyRevenue: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = invoices.reduce((sum, inv) => {
      const p = inv.payments.filter((pay) => pay.status === "COMPLETED" && pay.paidAt >= start && pay.paidAt < end);
      return sum + p.reduce((s, pay) => s + Number(pay.amount), 0);
    }, 0);
    monthlyRevenue.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      value: Math.round(total * 100) / 100,
    });
  }

  const statusCounts = await prisma.subscription.groupBy({
    by: ["status"],
    where: { userId: uid },
    _count: true,
  });
  const statusBreakdown = statusCounts.map((s) => ({
    name: titleCase(s.status),
    value: s._count,
  }));

  return apiJson({
    data: {
      totalCustomers,
      activeSubscriptions,
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      overdueInvoices,
      expiringSubs,
      currency,
      monthlyRevenue,
      statusBreakdown,
    },
  });
}
