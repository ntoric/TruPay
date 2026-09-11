import { prisma } from "@/lib/prisma";
import { getSessionUser, getOrCreateSettings } from "@/lib/session";
import PageHeader from "@/components/layout/page-header";
import SettingsForm from "@/components/settings/settings-form";
import ExportButton from "@/components/settings/export-button";
import ApiKeysSection from "@/components/settings/api-keys-section";
import WebhooksSection from "@/components/settings/webhooks-section";
import { updateSettings } from "@/app/actions/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const settings = await getOrCreateSettings(user.id);

  // API keys + webhook endpoints (with recent delivery logs) for external integrations
  const [apiKeys, webhookEndpoints] = await Promise.all([
    prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhookEndpoint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure SMTP, SMS, Telegram, and your company details used in invoices and notifications."
      />
      <SettingsForm action={updateSettings} initial={settings} />

      {/* External integrations: API keys & webhooks */}
      <div className="mt-8 space-y-6">
        <ApiKeysSection keys={apiKeys} />
        <WebhooksSection endpoints={webhookEndpoints} />
      </div>

      {/* Data export */}
      <div className="mt-8 card p-6">
        <h2 className="text-base font-semibold">Data export</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Download all your account data — customers, products, plans, subscriptions,
          invoices, payments, notification rules and logs — as separate CSV files in a single ZIP archive.
        </p>
        <div className="mt-4">
          <ExportButton />
        </div>
      </div>
    </div>
  );
}
