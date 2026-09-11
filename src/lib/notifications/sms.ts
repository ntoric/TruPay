import twilio from "twilio";
import type { Settings } from "@prisma/client";

export async function sendSms(
  settings: Settings,
  to: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  const provider = settings.smsProvider ?? "none";

  try {
    if (provider === "twilio") {
      if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioFromNumber) {
        return { success: false, error: "Twilio not fully configured" };
      }
      const client = twilio(settings.twilioAccountSid, settings.twilioAuthToken);
      await client.messages.create({
        body: message,
        from: settings.twilioFromNumber,
        to,
      });
      return { success: true };
    }

    if (provider === "vonage") {
      if (!settings.vonageApiKey || !settings.vonageApiSecret || !settings.vonageFromNumber) {
        return { success: false, error: "Vonage not fully configured" };
      }
      // Vonage REST API (SMS)
      const params = new URLSearchParams({
        api_key: settings.vonageApiKey,
        api_secret: settings.vonageApiSecret,
        from: settings.vonageFromNumber,
        to: to.replace(/\D/g, ""),
        text: message,
      });
      const res = await fetch("https://rest.nexmo.com/sms/json", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const data = await res.json();
      const ok = data.messages?.[0]?.status === "0";
      return ok
        ? { success: true }
        : { success: false, error: data.messages?.[0]?.["error-text"] ?? "Vonage error" };
    }

    return { success: false, error: `SMS provider "${provider}" not supported` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
