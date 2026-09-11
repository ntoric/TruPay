import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Outbound webhook dispatch.
 *
 * For a given event + payload, finds the user's active webhook endpoints that
 * subscribe to the event (or to all events), signs the JSON body with the
 * endpoint's secret using HMAC-SHA256, POSTs it to the endpoint URL, and
 * records a delivery log with the response status/body.
 *
 * Delivery is best-effort and non-blocking from the caller's perspective:
 * failures are logged but never throw back into the originating request.
 */

const SIGNATURE_HEADER = "x-subhub-signature";
const EVENT_HEADER = "x-subhub-event";
const TIMESTAMP_HEADER = "x-subhub-timestamp";
const DELIVERY_HEADER = "x-subhub-delivery";

/** Max bytes of response body to store in the delivery log. */
const MAX_LOG_BODY = 2000;
/** Request timeout for outbound POSTs (ms). */
const DELIVERY_TIMEOUT_MS = 10_000;

export interface WebhookPayload {
  event: string;
  timestamp: string; // ISO 8601
  data: unknown;
}

/** Sign a raw body with the endpoint secret (HMAC-SHA256, hex). */
export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Emit a webhook event to all matching endpoints for a user.
 * Safe to await; never rejects (errors are logged to the delivery table).
 */
export async function dispatchWebhookEvent(
  userId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId, isActive: true },
  });
  if (endpoints.length === 0) return;

  const matching = endpoints.filter(
    (e) => e.events.length === 0 || e.events.includes(event),
  );
  if (matching.length === 0) return;

  await Promise.allSettled(
    matching.map((endpoint) => deliver(endpoint, event, data)),
  );
}

async function deliver(
  endpoint: { id: string; url: string; secret: string },
  event: string,
  data: unknown,
): Promise<void> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);
  const signature = signPayload(body, endpoint.secret);
  const deliveryId = await createDeliveryRecord(endpoint.id, event, payload);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;
  let status: "SUCCESS" | "FAILED" = "FAILED";

  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        [EVENT_HEADER]: event,
        [TIMESTAMP_HEADER]: payload.timestamp,
        [DELIVERY_HEADER]: deliveryId,
      },
      body,
      signal: controller.signal,
    });

    statusCode = res.status;
    const text = await res.text();
    responseBody = text.slice(0, MAX_LOG_BODY);
    // 2xx = success
    if (res.status >= 200 && res.status < 300) status = "SUCCESS";
    else errorMsg = `Unexpected status ${res.status}`;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Delivery failed";
  } finally {
    clearTimeout(timeout);
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { statusCode, responseBody, status, error: errorMsg },
  });
}

/** Create the initial PENDING delivery record and return its id. */
async function createDeliveryRecord(
  endpointId: string,
  event: string,
  payload: WebhookPayload,
): Promise<string> {
  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId,
      event,
      payload: payload as unknown as Prisma.InputJsonValue,
      status: "PENDING",
    },
    select: { id: true },
  });
  return delivery.id;
}

/** Re-deliver a previously recorded delivery (e.g. from a "retry" action). */
export async function redeliverWebhook(deliveryId: string, userId: string): Promise<{
  error?: string;
}> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });
  if (!delivery || delivery.endpoint.userId !== userId) {
    return { error: "Delivery not found" };
  }
  if (!delivery.endpoint.isActive) {
    return { error: "Endpoint is disabled" };
  }

  const payload = delivery.payload as unknown as WebhookPayload;
  const body = JSON.stringify(payload);
  const signature = signPayload(body, delivery.endpoint.secret);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let errorMsg: string | null = null;
  let status: "SUCCESS" | "FAILED" = "FAILED";

  try {
    const res = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SIGNATURE_HEADER]: signature,
        [EVENT_HEADER]: delivery.event,
        [TIMESTAMP_HEADER]: payload.timestamp,
        [DELIVERY_HEADER]: deliveryId,
      },
      body,
      signal: controller.signal,
    });
    statusCode = res.status;
    responseBody = (await res.text()).slice(0, MAX_LOG_BODY);
    if (res.status >= 200 && res.status < 300) status = "SUCCESS";
    else errorMsg = `Unexpected status ${res.status}`;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Delivery failed";
  } finally {
    clearTimeout(timeout);
  }

  // Record the retry attempt as a new delivery log entry
  await prisma.webhookDelivery.create({
    data: {
      endpointId: delivery.endpointId,
      event: delivery.event,
      payload: delivery.payload as Prisma.InputJsonValue,
      statusCode,
      responseBody,
      status,
      error: errorMsg,
      attempt: delivery.attempt + 1,
    },
  });

  return {};
}
