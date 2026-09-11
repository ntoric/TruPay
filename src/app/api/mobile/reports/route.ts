import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { addDays, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const uid = user.id;

  const [subs, invoices, plans, customers] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: uid },
      include: { plan: true, customer: true },
    }),
    prisma.invoice.findMany({
      where: { userId: uid },
      include: { payments: true, customer: true },
    }),
    prisma.plan.findMany({
      where: { userId: uid },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.customer.count({ where: { userId: uid } }),
  ]);

  const now = new Date();

  // Revenue last 12 months
  const monthlyRevenue: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = invoices.reduce((sum, inv) => {
      const p = inv.payments.filter((pay) => pay.paidAt >= start && pay.paidAt < end && pay.status === "COMPLETED");
      return sum + p.reduce((s, pay) => s + Number(pay.amount), 0);
    }, 0);
    monthlyRevenue.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      value: Math.round(total * 100) / 100,
    });
  }

  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.value, 0);
  const avgMonthly = totalRevenue / 12;

  // MRR
  const activeSubs = subs.filter((s) => s.status === "ACTIVE");
  const mrr = activeSubs.reduce((sum, s) => {
    const days = s.plan.durationDays || 30;
    return sum + (Number(s.price) / days) * 30;
  }, 0);
  const arr = mrr * 12;

  // Churn
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const expiredThisMonth = subs.filter(
    (s) => s.status === "EXPIRED" && s.endDate >= monthStart && s.endDate < addDays(monthStart, 30),
  ).length;
  const activeAtStart = subs.filter((s) => s.startDate < monthStart && s.endDate >= monthStart).length;
  const churnRate = activeAtStart > 0 ? (expiredThisMonth / activeAtStart) * 100 : 0;

  // Plan popularity
  const planPopularity = plans
    .map((p) => ({
      name: p.name,
      count: p._count.subscriptions,
      revenue: subs.filter((s) => s.planId === p.id).reduce((sum, s) => sum + Number(s.price), 0),
    }))
    .sort((a, b) => b.count - a.count);

  // Outstanding
  const outstanding = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "CANCELLED" && i.status !== "DRAFT")
    .reduce((s, i) => {
      const paid = i.payments.filter((p) => p.status === "COMPLETED").reduce((a, p) => a + Number(p.amount), 0);
      return s + Math.max(0, Number(i.total) - paid);
    }, 0);

  // Top customers
  const customerRevenue = new Map<string, { name: string; total: number }>();
  for (const inv of invoices) {
    for (const p of inv.payments) {
      if (p.status !== "COMPLETED") continue;
      const entry = customerRevenue.get(inv.customerId) ?? { name: inv.customer.name, total: 0 };
      entry.total += Number(p.amount);
      customerRevenue.set(inv.customerId, entry);
    }
  }
  const topCustomers = [...customerRevenue.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  // Status breakdown
  const statusMap: Record<string, { count: number; value: number }> = {};
  for (const s of subs) {
    if (!statusMap[s.status]) statusMap[s.status] = { count: 0, value: 0 };
    statusMap[s.status].count += 1;
    statusMap[s.status].value += Number(s.price);
  }
  const statusBreakdown = Object.entries(statusMap).map(([status, v]) => ({
    name: titleCase(status),
    count: v.count,
    value: Math.round(v.value * 100) / 100,
  }));

  return jsonResponse({
    monthlyRevenue,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgMonthly: Math.round(avgMonthly * 100) / 100,
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    churnRate: Math.round(churnRate * 10) / 10,
    activeSubscriptions: activeSubs.length,
    totalCustomers: customers,
    outstanding: Math.round(outstanding * 100) / 100,
    totalInvoices: invoices.length,
    planPopularity,
    topCustomers,
    statusBreakdown,
  });
}
