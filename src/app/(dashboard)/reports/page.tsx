import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import StatCard from "@/components/ui/stat-card";
import RevenueChart from "@/components/charts/revenue-chart";
import { formatCurrency, titleCase, addDays } from "@/lib/utils";
import { DollarSign, TrendingUp, Users, RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const uid = user.id;

  const settings = await prisma.settings.findUnique({ where: { userId: uid } });
  const currency = settings?.currency ?? "INR";

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
  const months: { label: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = invoices.reduce((sum, inv) => {
      const p = inv.payments.filter((pay) => pay.paidAt >= start && pay.paidAt < end && pay.status === "COMPLETED");
      return sum + p.reduce((s, pay) => s + Number(pay.amount), 0);
    }, 0);
    months.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      value: Math.round(total * 100) / 100,
    });
  }

  const totalRevenue = months.reduce((s, m) => s + m.value, 0);
  const avgMonthly = totalRevenue / 12;

  // MRR
  const activeSubs = subs.filter((s) => s.status === "ACTIVE");
  const mrr = activeSubs.reduce((sum, s) => {
    const days = s.plan.durationDays || 30;
    return sum + (Number(s.price) / days) * 30;
  }, 0);

  // ARR
  const arr = mrr * 12;

  // Churn: subscriptions that expired this month / active at start of month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const expiredThisMonth = subs.filter(
    (s) => s.status === "EXPIRED" && s.endDate >= monthStart && s.endDate < addDays(monthStart, 30),
  ).length;
  const activeAtStart = subs.filter((s) => s.startDate < monthStart && s.endDate >= monthStart).length;
  const churnRate = activeAtStart > 0 ? (expiredThisMonth / activeAtStart) * 100 : 0;

  // Plan popularity
  const planStats = plans
    .map((p) => ({
      name: p.name,
      count: p._count.subscriptions,
      revenue: subs
        .filter((s) => s.planId === p.id)
        .reduce((sum, s) => sum + Number(s.price), 0),
    }))
    .sort((a, b) => b.count - a.count);

  // Outstanding (unpaid invoices)
  const outstanding = invoices
    .filter((i) => i.status !== "PAID" && i.status !== "CANCELLED" && i.status !== "DRAFT")
    .reduce((s, i) => {
      const paid = i.payments.filter((p) => p.status === "COMPLETED").reduce((a, p) => a + Number(p.amount), 0);
      return s + Math.max(0, Number(i.total) - paid);
    }, 0);

  // Top customers by revenue
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

  return (
    <div>
      <PageHeader title="Reports" description="Revenue, churn and plan analytics." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total revenue (12mo)" value={formatCurrency(totalRevenue, currency)} icon={<DollarSign className="h-5 w-5" />} tone="success" />
        <StatCard label="Avg monthly revenue" value={formatCurrency(avgMonthly, currency)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="MRR / ARR" value={`${formatCurrency(mrr, currency)} / ${formatCurrency(arr, currency)}`} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Churn rate (mo)" value={`${churnRate.toFixed(1)}%`} icon={<RotateCcw className="h-5 w-5" />} tone={churnRate > 10 ? "danger" : "default"} />
        <StatCard label="Active subscriptions" value={activeSubs.length} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Total customers" value={customers} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Outstanding" value={formatCurrency(outstanding, currency)} icon={<DollarSign className="h-5 w-5" />} tone={outstanding > 0 ? "warning" : "default"} />
        <StatCard label="Total invoices" value={invoices.length} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <div className="mt-6 card p-5">
        <h2 className="mb-4 text-base font-semibold">Revenue (last 12 months)</h2>
        <RevenueChart data={months} currency={currency} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold">Plan popularity</h2>
          </div>
          {planStats.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">No plans.</p>
          ) : (
            <table className="table-base">
              <thead><tr><th>Plan</th><th className="text-right">Subscriptions</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {planStats.map((p) => (
                  <tr key={p.name}>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-right">{p.count}</td>
                    <td className="text-right font-medium">{formatCurrency(p.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-semibold">Top customers by revenue</h2>
          </div>
          {topCustomers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--muted)]">No revenue yet.</p>
          ) : (
            <table className="table-base">
              <thead><tr><th>Customer</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={i}>
                    <td className="font-medium">{c.name}</td>
                    <td className="text-right font-medium">{formatCurrency(c.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6 card overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold">Subscription status breakdown</h2>
        </div>
        <table className="table-base">
          <thead><tr><th>Status</th><th className="text-right">Count</th><th className="text-right">Value</th></tr></thead>
          <tbody>
            {Object.entries(
              subs.reduce((acc, s) => {
                acc[s.status] = (acc[s.status] ?? 0) + 1;
                return acc;
              }, {} as Record<string, number>),
            ).map(([status, count]) => (
              <tr key={status}>
                <td className="font-medium">{titleCase(status)}</td>
                <td className="text-right">{count}</td>
                <td className="text-right">
                  {formatCurrency(
                    subs.filter((s) => s.status === status).reduce((sum, s) => sum + Number(s.price), 0),
                    currency,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
