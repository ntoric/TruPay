import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

export interface JwtPayload {
  userId: string;
  email: string;
}

/** Sign a JWT for a user */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

/** Verify a JWT and return the payload, or null if invalid */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/** Extract and verify the Bearer token from an Authorization header */
export function getUserFromAuthHeader(
  authHeader: string | null,
): Promise<{ id: string; email: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return Promise.resolve(null);
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) return Promise.resolve(null);
  return prisma.user
    .findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    })
    .then((u) => u ?? null);
}

/** JSON response helper */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Error response helper */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}
