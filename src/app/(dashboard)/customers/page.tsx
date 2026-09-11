import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import DeleteButton from "@/components/ui/delete-button";
import { deleteCustomer } from "@/app/actions/customers";
import { Users, Plus, Pencil, Mail, Phone } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const customers = await prisma.customer.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { subscriptions: true, invoices: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage your customers and their contact details."
        actions={
          <Link href="/customers/new" className="btn-primary">
            <Plus className="h-4 w-4" /> Add customer
          </Link>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No customers yet"
          description="Add your first customer to start creating subscriptions and invoices."
          action={
            <Link href="/customers/new" className="btn-primary">
              <Plus className="h-4 w-4" /> Add customer
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Company</th>
                <th>Subs</th>
                <th>Invoices</th>
                <th>Added</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>
                    <div className="flex flex-col gap-0.5 text-xs text-[var(--muted)]">
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {c.email}
                        </span>
                      )}
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {c.phone}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{c.company || "—"}</td>
                  <td>{c._count.subscriptions}</td>
                  <td>{c._count.invoices}</td>
                  <td className="text-[var(--muted)]">{formatDate(c.createdAt)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/customers/${c.id}/edit`}
                        className="btn-ghost"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteButton
                        onDelete={deleteCustomer.bind(null, c.id)}
                        confirmMessage={`Delete customer "${c.name}"? All their subscriptions and invoices will also be removed.`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
