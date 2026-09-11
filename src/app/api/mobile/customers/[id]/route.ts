import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  company: z.string().nullish(),
  address: z.string().nullish(),
  telegramChatId: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const customer = await prisma.customer.findFirst({ where: { id, userId: user.id } });
  if (!customer) return errorResponse("Customer not found", 404);
  return jsonResponse(customer);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const existing = await prisma.customer.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Customer not found", 404);
  const customer = await prisma.customer.update({ where: { id }, data: parsed.data });
  return jsonResponse(customer);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const existing = await prisma.customer.findFirst({ where: { id, userId: user.id } });
  if (!existing) return errorResponse("Customer not found", 404);
  await prisma.customer.delete({ where: { id } });
  return jsonResponse({ success: true });
}
