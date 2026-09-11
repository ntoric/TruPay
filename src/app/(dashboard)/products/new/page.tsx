import PageHeader from "@/components/layout/page-header";
import ProductForm from "@/components/products/product-form";
import { createProduct } from "@/app/actions/products";

export default function NewProductPage() {
  return (
    <div>
      <PageHeader title="New product" description="Create a product to link to subscriptions." />
      <ProductForm action={createProduct} submitLabel="Create product" />
    </div>
  );
}
