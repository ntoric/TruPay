import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  address: z.string().nullish(),
  telegramChatId: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const customers = await prisma.customer.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonResponse(customers);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const d = parsed.data;
  const customer = await prisma.customer.create({
    data: {
      userId: user.id,
      name: d.name,
      email: d.email ?? null,
      phone: d.phone ?? null,
      company: d.company ?? null,
      address: d.address ?? null,
      telegramChatId: d.telegramChatId ?? null,
      notes: d.notes ?? null,
    },
  });
  return jsonResponse(customer, 201);
}
