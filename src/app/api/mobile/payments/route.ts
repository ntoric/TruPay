import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { paidAt: "desc" },
    include: { invoice: { select: { invoiceNumber: true } } },
  });
  return jsonResponse(
    payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      invoiceNumber: p.invoice.invoiceNumber,
    })),
  );
}
