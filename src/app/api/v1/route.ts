import { apiJson } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Public API root — describes the available v1 endpoints.
 * No authentication required (this is documentation only).
 */
export function GET() {
  return apiJson({
    name: "SubHub API",
    version: "v1",
    description:
      "Read-only REST API for external systems. Authenticate with a Bearer API key (shub_...) in the Authorization header.",
    authentication: {
      type: "bearer",
      header: "Authorization: Bearer shub_<your-api-key>",
      docs: "Create API keys in Settings → API Keys.",
    },
    pagination: {
      limit: "Number of records per page (default 50, max 100)",
      offset: "Number of records to skip (default 0)",
    },
    endpoints: {
      dashboard: "GET /api/v1/dashboard — account summary stats",
      reports: "GET /api/v1/reports — revenue & subscription reports",
      customers: "GET /api/v1/customers, GET /api/v1/customers/:id",
      products: "GET /api/v1/products, GET /api/v1/products/:id",
      plans: "GET /api/v1/plans, GET /api/v1/plans/:id",
      subscriptions: "GET /api/v1/subscriptions, GET /api/v1/subscriptions/:id",
      invoices: "GET /api/v1/invoices, GET /api/v1/invoices/:id",
      payments: "GET /api/v1/payments, GET /api/v1/payments/:id",
    },
    webhooks: {
      description:
        "Outbound webhooks push signed event payloads to your endpoints. Configure them in Settings → Webhooks.",
      signatureHeader: "x-subhub-signature",
      eventHeader: "x-subhub-event",
      timestampHeader: "x-subhub-timestamp",
      deliveryHeader: "x-subhub-delivery",
      signatureAlgorithm: "HMAC-SHA256 of the raw JSON body using the endpoint secret (hex)",
    },
  });
}
