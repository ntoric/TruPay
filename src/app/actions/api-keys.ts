"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { z } from "zod";
import { generateApiKey, hashApiKey, API_KEY_PREFIX } from "@/lib/api-auth";

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
});

export type CreateApiKeyState = { error?: string; key?: string; id?: string } | undefined;

/**
 * Create a new API key. The full plaintext key is returned exactly once
 * (in `state.key`) so the UI can display it for the user to copy.
 */
export async function createApiKey(
  _prev: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({ name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const prefix = rawKey.slice(0, API_KEY_PREFIX.length + 8); // shub_ + 8 chars

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      keyHash,
      prefix,
    },
  });

  revalidatePath("/settings");
  return { key: rawKey, id: apiKey.id };
}

/** Revoke (soft-delete) an API key by id. */
export async function revokeApiKey(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "API key not found" };
  if (!existing.isActive) return { error: "API key already revoked" };

  await prisma.apiKey.update({
    where: { id },
    data: { isActive: false, revokedAt: new Date() },
  });

  revalidatePath("/settings");
  return {};
}

/** Permanently delete an API key. */
export async function deleteApiKey(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const existing = await prisma.apiKey.findFirst({ where: { id, userId: user.id } });
  if (!existing) return { error: "API key not found" };

  await prisma.apiKey.delete({ where: { id } });
  revalidatePath("/settings");
  return {};
}
