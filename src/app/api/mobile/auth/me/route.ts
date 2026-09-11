import { NextRequest } from "next/server";
import { getUserFromAuthHeader, jsonResponse, errorResponse } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromAuthHeader(req.headers.get("authorization"));
  if (!user) return errorResponse("Unauthorized", 401);
  return jsonResponse({ id: user.id, email: user.email });
}
