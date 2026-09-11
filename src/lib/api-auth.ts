import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Public REST API authentication via API keys.
 *
 * Keys are presented in the `Authorization` header as `Bearer shub_<secret>`.
 * We never store the full secret — only its sha256 hash plus a short display
 * prefix so the plaintext can be shown to the user exactly once on creation.
 */

export const API_KEY_PREFIX = "shub_";

/** Hash a raw API key secret with sha256 (hex). */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Generate a new random API key (returns the full plaintext, shown once). */
export function generateApiKey(): string {
  const secret = randomBytes(32).toString("hex");
  return `${API_KEY_PREFIX}${secret}`;
}

/** Extract the bearer token from an Authorization header value. */
export function extractBearer(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Authenticate a request by its Bearer API key.
 * Returns the owning user on success, or null if the key is missing/invalid/revoked.
 * Updates `lastUsedAt` on successful auth.
 */
export async function getUserFromApiKey(
  authHeader: string | null,
): Promise<{ id: string; email: string } | null> {
  const token = extractBearer(authHeader);
  if (!token || !token.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = hashApiKey(token);

  // Look up by hash. The prefix column is only for display.
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { id: true, userId: true, isActive: true },
  });

  if (!apiKey || !apiKey.isActive) return null;

  const user = await prisma.user.findUnique({
    where: { id: apiKey.userId },
    select: { id: true, email: true },
  });
  if (!user) return null;

  // Fire-and-forget lastUsedAt update
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return user;
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** JSON response helper (mirrors mobile-auth for consistency). */
export function apiJson(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Error response helper. */
export function apiError(message: string, status = 400): Response {
  return apiJson({ error: message }, status);
}

/** Parse pagination params from a URL, clamped to sane bounds. */
export function parsePagination(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
  return { limit, offset };
}
