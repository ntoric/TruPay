import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import ProductForm from "@/components/products/product-form";
import { updateProduct } from "@/app/actions/products";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: PageProps<"/products/[id]/edit">) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;

  const product = await prisma.product.findFirst({ where: { id, userId: user.id } });
  if (!product) notFound();

  const action = updateProduct.bind(null, id);

  return (
    <div>
      <PageHeader title="Edit product" description={product.name} />
      <ProductForm
        action={action}
        initial={{
          name: product.name,
          description: product.description,
          sku: product.sku,
          category: product.category,
          price: Number(product.price),
          isActive: product.isActive,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
