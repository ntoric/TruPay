"use client";

import { useActionState } from "react";
import { useState } from "react";
import type { Settings } from "@prisma/client";

export type SettingsFormState = { error?: string; telegramUsername?: string } | undefined;

export default function SettingsForm({
  action,
  initial,
}: {
  action: (prev: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;
  initial: Settings | null;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [smsProvider, setSmsProvider] = useState(initial?.smsProvider ?? "none");
  const [savedMsg, setSavedMsg] = useState("");

  // Show a transient success note when telegramUsername is returned (means saved ok)
  if (state?.telegramUsername && !savedMsg) {
    setSavedMsg(`Saved. Telegram bot @${state.telegramUsername} verified.`);
  } else if (state && !state.error && !state.telegramUsername && !savedMsg) {
    setSavedMsg("Settings saved.");
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      {state?.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      )}
      {savedMsg && !state?.error && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {savedMsg}
        </div>
      )}

      {/* Company */}
      <section className="card p-5">
        <h2 className="mb-4 text-base font-semibold">Company details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="companyName">Company name</label>
            <input id="companyName" name="companyName" className="input" defaultValue={initial?.companyName ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="companyAddress">Address</label>
            <input id="companyAddress" name="companyAddress" className="input" defaultValue={initial?.companyAddress ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="companyEmail">Email</label>
            <input id="companyEmail" name="companyEmail" type="email" className="input" defaultValue={initial?.companyEmail ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="companyPhone">Phone</label>
            <input id="companyPhone" name="companyPhone" className="input" defaultValue={initial?.companyPhone ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <input id="currency" name="currency" className="input" defaultValue={initial?.currency ?? "INR"} maxLength={5} />
          </div>
          <div>
            <label className="label" htmlFor="timezone">Timezone</label>
            <input id="timezone" name="timezone" className="input" defaultValue={initial?.timezone ?? "UTC"} />
          </div>
        </div>
      </section>

      {/* SMTP */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Email (SMTP)</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="emailEnabled" defaultChecked={initial?.emailEnabled ?? true} className="h-4 w-4 rounded border-[var(--border)]" />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="smtpHost">SMTP host</label>
            <input id="smtpHost" name="smtpHost" className="input" defaultValue={initial?.smtpHost ?? ""} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="label" htmlFor="smtpPort">Port</label>
            <input id="smtpPort" name="smtpPort" type="number" className="input" defaultValue={initial?.smtpPort ?? 587} />
          </div>
          <div>
            <label className="label" htmlFor="smtpUser">Username</label>
            <input id="smtpUser" name="smtpUser" className="input" defaultValue={initial?.smtpUser ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="smtpPass">Password</label>
            <input id="smtpPass" name="smtpPass" type="password" className="input" defaultValue={initial?.smtpPass ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="smtpFrom">From address</label>
            <input id="smtpFrom" name="smtpFrom" className="input" defaultValue={initial?.smtpFrom ?? ""} placeholder="noreply@yourcompany.com" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="smtpSecure" defaultChecked={initial?.smtpSecure ?? true} className="h-4 w-4 rounded border-[var(--border)]" />
            Use SSL/TLS (secure)
          </label>
        </div>
      </section>

      {/* SMS */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">SMS</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="smsEnabled" defaultChecked={initial?.smsEnabled ?? false} className="h-4 w-4 rounded border-[var(--border)]" />
            Enabled
          </label>
        </div>
        <div className="mb-4">
          <label className="label" htmlFor="smsProvider">Provider</label>
          <select id="smsProvider" name="smsProvider" className="input" value={smsProvider} onChange={(e) => setSmsProvider(e.target.value)}>
            <option value="none">None</option>
            <option value="twilio">Twilio</option>
            <option value="vonage">Vonage (Nexmo)</option>
          </select>
        </div>
        {smsProvider === "twilio" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="twilioAccountSid">Account SID</label>
              <input id="twilioAccountSid" name="twilioAccountSid" className="input" defaultValue={initial?.twilioAccountSid ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="twilioAuthToken">Auth token</label>
              <input id="twilioAuthToken" name="twilioAuthToken" type="password" className="input" defaultValue={initial?.twilioAuthToken ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="twilioFromNumber">From number</label>
              <input id="twilioFromNumber" name="twilioFromNumber" className="input" defaultValue={initial?.twilioFromNumber ?? ""} placeholder="+15550000000" />
            </div>
          </div>
        )}
        {smsProvider === "vonage" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="vonageApiKey">API key</label>
              <input id="vonageApiKey" name="vonageApiKey" className="input" defaultValue={initial?.vonageApiKey ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="vonageApiSecret">API secret</label>
              <input id="vonageApiSecret" name="vonageApiSecret" type="password" className="input" defaultValue={initial?.vonageApiSecret ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="vonageFromNumber">From number / name</label>
              <input id="vonageFromNumber" name="vonageFromNumber" className="input" defaultValue={initial?.vonageFromNumber ?? ""} />
            </div>
          </div>
        )}
      </section>

      {/* Telegram */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Telegram</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="telegramEnabled" defaultChecked={initial?.telegramEnabled ?? false} className="h-4 w-4 rounded border-[var(--border)]" />
            Enabled
          </label>
        </div>
        <div>
          <label className="label" htmlFor="telegramBotToken">Bot token</label>
          <input id="telegramBotToken" name="telegramBotToken" className="input" defaultValue={initial?.telegramBotToken ?? ""} placeholder="123456:ABC-DEF..." />
          <p className="mt-1 text-xs text-[var(--muted)]">
            Create a bot via <span className="font-mono">@BotFather</span> on Telegram and paste the token here.
            Customers must message the bot first so it can reply. Set each customer&apos;s Telegram Chat ID on their profile.
          </p>
          {initial?.telegramBotUsername && (
            <p className="mt-1 text-xs text-emerald-600">Connected bot: @{initial.telegramBotUsername}</p>
          )}
        </div>
      </section>

      {/* Cashfree */}
      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Cashfree Payments</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="cashfreeEnabled" defaultChecked={initial?.cashfreeEnabled ?? false} className="h-4 w-4 rounded border-[var(--border)]" />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cashfreeAppId">App ID (Client ID)</label>
            <input id="cashfreeAppId" name="cashfreeAppId" className="input" defaultValue={initial?.cashfreeAppId ?? ""} placeholder="1234567890abcdef" />
          </div>
          <div>
            <label className="label" htmlFor="cashfreeSecretKey">Secret Key (Client Secret)</label>
            <input id="cashfreeSecretKey" name="cashfreeSecretKey" type="password" className="input" defaultValue={initial?.cashfreeSecretKey ?? ""} placeholder="sk_..." />
          </div>
          <div>
            <label className="label" htmlFor="cashfreeEnvironment">Environment</label>
            <select id="cashfreeEnvironment" name="cashfreeEnvironment" className="input" defaultValue={initial?.cashfreeEnvironment ?? "sandbox"}>
              <option value="sandbox">Sandbox (Test)</option>
              <option value="production">Production (Live)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cashfreeWebhookSecret">Webhook Secret</label>
            <input id="cashfreeWebhookSecret" name="cashfreeWebhookSecret" type="password" className="input" defaultValue={initial?.cashfreeWebhookSecret ?? ""} placeholder="wh_..." />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-[var(--muted)]">
              Get your App ID and Secret Key from the{" "}
              <a href="https://merchant.cashfree.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                Cashfree Merchant Dashboard
              </a>
              . Set the webhook URL to{" "}
              <code className="rounded bg-[var(--muted-bg)] px-1 py-0.5 text-xs">
                {typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/payments/cashfree/webhook
              </code>{" "}
              and paste the webhook secret above.
            </p>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4">
        <button type="submit" className="btn-primary w-full shadow-lg">Save settings</button>
      </div>
    </form>
  );
}
