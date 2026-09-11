import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import DeleteButton from "@/components/ui/delete-button";
import { deleteProduct } from "@/app/actions/products";
import { Package, Plus, Pencil } from "lucide-react";
import { formatCurrency, formatDate, statusColor, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const settings = await prisma.settings.findUnique({ where: { userId: user.id } });
  const currency = settings?.currency ?? "INR";

  const products = await prisma.product.findMany({
    where: { userId: user.id },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Products"
        description="Create products that can be linked to subscriptions."
        actions={
          <Link href="/products/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New product
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No products yet"
          description="Create a product to link it to customer subscriptions and filter by product."
          action={
            <Link href="/products/new" className="btn-primary">
              <Plus className="h-4 w-4" /> New product
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Subscriptions</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="text-[var(--muted)]">{p.sku ?? "—"}</td>
                  <td>{p.category ?? "—"}</td>
                  <td className="font-medium">{formatCurrency(p.price, currency)}</td>
                  <td>{p._count.subscriptions}</td>
                  <td>
                    {p.isActive ? (
                      <span className="badge bg-emerald-50 text-emerald-700 border-emerald-200">Active</span>
                    ) : (
                      <span className="badge bg-gray-100 text-gray-500 border-gray-200">Inactive</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/products/${p.id}/edit`} className="btn-ghost" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteButton
                        onDelete={deleteProduct.bind(null, p.id)}
                        confirmMessage={`Delete product "${p.name}"? Linked subscriptions will be unlinked but not deleted.`}
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
