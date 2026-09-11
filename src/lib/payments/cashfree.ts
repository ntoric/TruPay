/**
 * Cashfree Payment Gateway integration.
 *
 * Docs: https://www.cashfree.com/docs/payments/online
 * API version: 2025-01-01
 *
 * Flow:
 *  1. Backend creates an order via POST /pg/orders → returns payment_session_id
 *  2. Client (web or mobile) opens the Cashfree checkout using the session id
 *  3. After payment, Cashfree redirects (web) or returns (mobile) to the app
 *  4. App calls backend /verify to confirm payment status
 *  5. Cashfree also sends a webhook → backend verifies signature & records payment
 *
 * Auto-renewals:
 *  - For subscriptions with autoRenew=true, the maintenance cron creates a new
 *    invoice and a Cashfree order, then charges a saved instrument (token) if
 *    available. Otherwise a payment link is sent to the customer.
 */

import { createHmac } from "crypto";

const API_VERSION = "2025-01-01";

export type CashfreeEnv = "sandbox" | "production";

export interface CashfreeConfig {
  appId: string;
  secretKey: string;
  environment: CashfreeEnv;
  webhookSecret?: string;
}

export function getBaseUrl(env: CashfreeEnv): string {
  return env === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

function headers(cfg: CashfreeConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-version": API_VERSION,
    "X-Client-Id": cfg.appId,
    "X-Client-Secret": cfg.secretKey,
  };
}

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  currency: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  returnUrl?: string;
  notifyUrl?: string;
  paymentMethods?: string;
  notes?: Record<string, string>;
}

export interface CashfreeOrder {
  cf_order_id: string;
  order_id: string;
  payment_session_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  order_expiry_time?: string;
  created_at: string;
}

export async function createOrder(
  cfg: CashfreeConfig,
  input: CreateOrderInput,
): Promise<CashfreeOrder> {
  const url = `${getBaseUrl(cfg.environment)}/orders`;
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    order_amount: input.amount,
    order_currency: input.currency,
    customer_details: {
      customer_id: input.customer.id,
      customer_name: input.customer.name,
      customer_email: input.customer.email,
      customer_phone: input.customer.phone,
    },
    order_meta: {
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
      ...(input.paymentMethods ? { payment_methods: input.paymentMethods } : {}),
    },
    ...(input.notes ? { order_note: JSON.stringify(input.notes) } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: headers(cfg),
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Cashfree createOrder failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data as CashfreeOrder;
}

export interface CashfreePayment {
  cf_payment_id: string;
  order_id: string;
  payment_status: string; // SUCCESS | FAILED | PENDING | USER_DROPPED
  payment_amount: number;
  payment_currency: string;
  payment_method?: {
    [key: string]: unknown;
  };
  payment_group?: string;
  created_at?: string;
}

export async function getPaymentsForOrder(
  cfg: CashfreeConfig,
  orderId: string,
): Promise<CashfreePayment[]> {
  const url = `${getBaseUrl(cfg.environment)}/orders/${orderId}/payments`;
  const res = await fetch(url, { method: "GET", headers: headers(cfg) });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Cashfree getPayments failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return Array.isArray(data) ? data : [];
}

export async function getOrder(
  cfg: CashfreeConfig,
  orderId: string,
): Promise<CashfreeOrder & { order_status: string }> {
  const url = `${getBaseUrl(cfg.environment)}/orders/${orderId}`;
  const res = await fetch(url, { method: "GET", headers: headers(cfg) });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Cashfree getOrder failed: ${res.status} ${JSON.stringify(data)}`,
    );
  }
  return data;
}

/**
 * Verify a Cashfree webhook signature.
 *
 * signatureData = timestamp + rawBody
 * expectedSignature = Base64(HMAC_SHA256(signatureData, webhookSecret))
 */
export function verifyWebhookSignature(
  signature: string,
  rawBody: string,
  timestamp: string,
  webhookSecret: string,
): boolean {
  try {
    const signatureData = timestamp + rawBody;
    const expected = createHmac("sha256", webhookSecret)
      .update(signatureData)
      .digest("base64");
    return expected === signature;
  } catch {
    return false;
  }
}

/**
 * Create a payment link for an order (used for auto-renewal notifications).
 * Cashfree payment links are created via the dashboard or the Links API.
 * Here we generate a checkout URL using the payment session id.
 */
export function buildCheckoutUrl(
  env: CashfreeEnv,
  paymentSessionId: string,
  returnUrl?: string,
): string {
  const base =
    env === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  const params = new URLSearchParams({ "payment-session-id": paymentSessionId });
  if (returnUrl) params.set("return_url", returnUrl);
  return `${base}/checkout?${params.toString()}`;
}
