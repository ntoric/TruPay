import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);

  const { email, password, name } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return errorResponse("Email already registered", 409);

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, name: name ?? null, password: hashed },
  });
  await prisma.settings.create({ data: { userId: user.id } });

  const token = signToken({ userId: user.id, email: user.email });
  return jsonResponse({ token, user: { id: user.id, email: user.email, name: user.name } }, 201);
}
