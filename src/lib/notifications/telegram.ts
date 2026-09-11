import { Bot } from "grammy";
import type { Settings } from "@prisma/client";

/**
 * Send a Telegram message to a specific chat id using the user's bot token.
 */
export async function sendTelegram(
  settings: Settings,
  chatId: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  if (!settings.telegramBotToken) {
    return { success: false, error: "Telegram bot token not configured" };
  }
  try {
    const bot = new Bot(settings.telegramBotToken);
    await bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Verify a bot token by calling getMe. Returns the bot username on success.
 */
export async function verifyTelegramBot(
  token: string,
): Promise<{ success: boolean; username?: string; error?: string }> {
  try {
    const bot = new Bot(token);
    const me = await bot.api.getMe();
    return { success: true, username: me.username };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
