"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(2000).optional().or(z.literal("")),
  sku: z.string().max(100).optional().or(z.literal("")),
  category: z.string().max(100).optional().or(z.literal("")),
  price: z.string().optional(),
  isActive: z.string().optional(),
});

export type ProductFormState = { error?: string } | undefined;

export async function createProduct(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireUser();
  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    category: String(formData.get("category") ?? ""),
    price: String(formData.get("price") ?? "0"),
    isActive: String(formData.get("isActive") ?? "on"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const price = parseFloat(d.price || "0") || 0;

  await prisma.product.create({
    data: {
      userId: user.id,
      name: d.name,
      description: d.description || null,
      sku: d.sku || null,
      category: d.category || null,
      price,
      isActive: d.isActive === "on",
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function updateProduct(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireUser();
  const existing = await prisma.product.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Product not found" };

  const parsed = productSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    category: String(formData.get("category") ?? ""),
    price: String(formData.get("price") ?? "0"),
    isActive: String(formData.get("isActive") ?? "on"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const price = parseFloat(d.price || "0") || 0;

  await prisma.product.update({
    where: { id },
    data: {
      name: d.name,
      description: d.description || null,
      sku: d.sku || null,
      category: d.category || null,
      price,
      isActive: d.isActive === "on",
    },
  });

  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.product.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "Product not found" };
  await prisma.product.delete({ where: { id } });
  revalidatePath("/products");
  return {};
}
