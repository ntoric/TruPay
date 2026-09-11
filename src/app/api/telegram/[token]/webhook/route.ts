import { NextResponse } from "next/server";
import { Bot } from "grammy";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, daysUntil, titleCase } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Telegram webhook. The URL contains the bot token so only Telegram can call it.
 * Set the webhook with:
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/<TOKEN>/webhook"
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/telegram/[token]/webhook">,
) {
  const { token } = await ctx.params;

  // Find the user whose bot token matches
  const settings = await prisma.settings.findFirst({
    where: { telegramBotToken: token },
  });
  if (!settings) return NextResponse.json({ ok: false }, { status: 404 });

  const body = await request.json();
  const msg = body?.message;
  if (!msg || !msg.text) return NextResponse.json({ ok: true });

  const chatId = String(msg.chat?.id);
  const text: string = String(msg.text || "").trim();
  const command = text.split(" ")[0].toLowerCase();

  const bot = new Bot(token);

  try {
    // Try to find a customer by their telegram chat id (for this user)
    const customer = await prisma.customer.findFirst({
      where: { userId: settings.userId, telegramChatId: chatId },
    });

    if (command === "/start" || command === "/help") {
      await bot.api.sendMessage(
        chatId,
        [
          "🤖 <b>SubHub Bot</b>",
          "",
          "Commands:",
          "/start — show this help",
          "/link &lt;your-email&gt; — link this chat to your customer account",
          "/status — view your active subscriptions",
          "/invoices — view your recent invoices",
          "",
          "Ask your provider to add your Telegram Chat ID to your profile: <code>" + chatId + "</code>",
        ].join("\n"),
        { parse_mode: "HTML" },
      );
      return NextResponse.json({ ok: true });
    }

    if (command === "/link") {
      const email = text.split(" ")[1]?.toLowerCase();
      if (!email) {
        await bot.api.sendMessage(chatId, "Usage: /link your@email.com", { parse_mode: "HTML" });
        return NextResponse.json({ ok: true });
      }
      const c = await prisma.customer.findFirst({
        where: { userId: settings.userId, email },
      });
      if (!c) {
        await bot.api.sendMessage(chatId, "No customer found with that email.");
        return NextResponse.json({ ok: true });
      }
      await prisma.customer.update({ where: { id: c.id }, data: { telegramChatId: chatId } });
      await bot.api.sendMessage(chatId, `✅ Linked! Welcome, <b>${c.name}</b>.`, { parse_mode: "HTML" });
      return NextResponse.json({ ok: true });
    }

    // The following commands require a linked customer
    if (!customer) {
      await bot.api.sendMessage(
        chatId,
        "This chat isn't linked yet. Use /link your@email.com to link your account.",
      );
      return NextResponse.json({ ok: true });
    }

    if (command === "/status") {
      const subs = await prisma.subscription.findMany({
        where: { customerId: customer.id, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
        include: { plan: true },
      });
      if (subs.length === 0) {
        await bot.api.sendMessage(chatId, "You have no active subscriptions.");
      } else {
        const lines = subs.map((s) => {
          const d = daysUntil(s.endDate);
          return `• <b>${s.plan.name}</b> — ${titleCase(s.status)}\n  Ends: ${formatDate(s.endDate)} (${d < 0 ? "expired" : d + "d left"})`;
        });
        await bot.api.sendMessage(
          chatId,
          `📋 <b>Your subscriptions</b>\n\n${lines.join("\n\n")}`,
          { parse_mode: "HTML" },
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (command === "/invoices") {
      const invoices = await prisma.invoice.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (invoices.length === 0) {
        await bot.api.sendMessage(chatId, "You have no invoices.");
      } else {
        const lines = invoices.map((i) =>
          `• <b>${i.invoiceNumber}</b> — ${formatCurrency(i.total, i.currency)} — ${titleCase(i.status)} (due ${formatDate(i.dueDate)})`,
        );
        await bot.api.sendMessage(
          chatId,
          `🧾 <b>Recent invoices</b>\n\n${lines.join("\n")}`,
          { parse_mode: "HTML" },
        );
      }
      return NextResponse.json({ ok: true });
    }

    await bot.api.sendMessage(
      chatId,
      "Unknown command. Send /help to see available commands.",
    );
  } catch (err) {
    console.error("[telegram webhook]", err);
  }

  return NextResponse.json({ ok: true });
}
