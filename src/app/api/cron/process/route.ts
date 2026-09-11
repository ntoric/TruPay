import { NextResponse } from "next/server";
import { processScheduledNotifications } from "@/lib/notifications/scheduler";
import { runMaintenance } from "@/lib/notifications/maintenance";

export const dynamic = "force-dynamic";

// Protected by a shared secret passed via ?token= or x-cron-token header.
const CRON_SECRET = process.env.CRON_SECRET || process.env.AUTH_SECRET || "dev-only";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token =
    url.searchParams.get("token") ||
    request.headers.get("x-cron-token") ||
    "";
  if (token !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const maintenance = await runMaintenance();
    const notifications = await processScheduledNotifications();
    return NextResponse.json({
      ok: true,
      maintenance,
      notifications,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
