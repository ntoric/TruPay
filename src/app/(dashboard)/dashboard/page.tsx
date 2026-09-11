import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import StatCard from "@/components/ui/stat-card";
import {
  Users,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, daysUntil, statusColor, titleCase } from "@/lib/utils";
import RevenueChart from "@/components/charts/revenue-chart";
import StatusBreakdownChart from "@/components/charts/status-breakdown-chart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const uid = user.id;

  const settings = await prisma.settings.findUnique({ where: { userId: uid } });
  const currency = settings?.currency ?? "INR";

  const [customers, activeSubs, invoices, expiring, recentSubs] =
    await Promise.all([
      prisma.customer.count({ where: { userId: uid } }),
      prisma.subscription.count({ where: { userId: uid, status: "ACTIVE" } }),
      prisma.invoice.findMany({
        where: { userId: uid, status: { in: ["PAID", "PARTIAL"] } },
        select: { total: true, createdAt: true, payments: { select: { amount: true, paidAt: true } } },
      }),
      prisma.subscription.count({
        where: {
          userId: uid,
          status: "ACTIVE",
          endDate: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.subscription.findMany({
        where: { userId: uid },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true, plan: true },
      }),
    ]);

  // Monthly recurring revenue: sum of active subscription prices normalized to monthly
  const activeSubRows = await prisma.subscription.findMany({
    where: { userId: uid, status: "ACTIVE" },
    include: { plan: true },
  });
  const mrr = activeSubRows.reduce((sum, s) => {
    const days = s.plan.durationDays || 30;
    const monthly = (Number(s.price) / days) * 30;
    return sum + monthly;
  }, 0);

  // Revenue this month (sum of completed payments this month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenueThisMonth = invoices.reduce((sum, inv) => {
    const payments = inv.payments.filter(
      (p) => p.paidAt >= monthStart,
    );
    return sum + payments.reduce((s, p) => s + Number(p.amount), 0);
  }, 0);

  const overdueInvoices = await prisma.invoice.count({
    where: { userId: uid, status: "OVERDUE" },
  });

  // Revenue last 6 months (from payments)
  const months: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const total = invoices.reduce((sum, inv) => {
      const p = inv.payments.filter((pay) => pay.paidAt >= start && pay.paidAt < end);
      return sum + p.reduce((s, pay) => s + Number(pay.amount), 0);
    }, 0);
    months.push({
      label: start.toLocaleDateString("en-US", { month: "short" }),
      value: Math.round(total * 100) / 100,
    });
  }

  // Status breakdown
  const statusCounts = await prisma.subscription.groupBy({
    by: ["status"],
    where: { userId: uid },
    _count: true,
  });
  const statusData = statusCounts.map((s) => ({
    name: titleCase(s.status),
    value: s._count,
  }));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user.name ?? "User"}. Here's your overview.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Customers" value={customers} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active Subscriptions" value={activeSubs} icon={<CreditCard className="h-5 w-5" />} tone="success" />
        <StatCard label="MRR (est.)" value={formatCurrency(mrr, currency)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard label="Revenue (this month)" value={formatCurrency(revenueThisMonth, currency)} icon={<TrendingUp className="h-5 w-5" />} tone="success" />
        <StatCard label="Overdue Invoices" value={overdueInvoices} icon={<AlertTriangle className="h-5 w-5" />} tone={overdueInvoices ? "danger" : "default"} />
        <StatCard label="Expiring (7 days)" value={expiring} icon={<Clock className="h-5 w-5" />} tone={expiring ? "warning" : "default"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Revenue (last 6 months)</h2>
          <RevenueChart data={months} currency={currency} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold">Subscriptions by status</h2>
          {statusData.length ? (
            <StatusBreakdownChart data={statusData} />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--muted)]">No subscriptions yet</p>
          )}
        </div>
      </div>

      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-semibold">Recent subscriptions</h2>
          <Link href="/subscriptions" className="text-sm font-medium text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        {recentSubs.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-[var(--muted)]">
            No subscriptions yet.{" "}
            <Link href="/subscriptions" className="text-indigo-600 hover:underline">Add one</Link>.
          </p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Ends</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {recentSubs.map((s) => {
                const dleft = daysUntil(s.endDate);
                return (
                  <tr key={s.id}>
                    <td className="font-medium">{s.customer.name}</td>
                    <td>{s.plan.name}</td>
                    <td>
                      <span className={`badge ${statusColor(s.status)}`}>{titleCase(s.status)}</span>
                    </td>
                    <td>
                      <span className={dleft < 0 ? "text-rose-600" : dleft < 7 ? "text-amber-600" : ""}>
                        {formatDate(s.endDate)}
                      </span>
                    </td>
                    <td className="font-medium">{formatCurrency(s.price, currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
