import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken, jsonResponse, errorResponse } from "@/lib/mobile-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("Invalid email or password", 422);

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.password) return errorResponse("Invalid email or password", 401);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return errorResponse("Invalid email or password", 401);

  const token = signToken({ userId: user.id, email: user.email });
  return jsonResponse({ token, user: { id: user.id, email: user.email, name: user.name } });
}
