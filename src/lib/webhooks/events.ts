/**
 * Catalog of outbound webhook events that SubHub can deliver to external systems.
 * Each event name follows the `<resource>.<action>` convention.
 *
 * When adding a new event, also emit it from the relevant action via
 * `dispatchWebhookEvent` in `./dispatch.ts`.
 */
export const WEBHOOK_EVENTS = [
  // Customers
  "customer.created",
  "customer.updated",
  "customer.deleted",
  // Products
  "product.created",
  "product.updated",
  "product.deleted",
  // Plans
  "plan.created",
  "plan.updated",
  "plan.deleted",
  // Subscriptions
  "subscription.created",
  "subscription.updated",
  "subscription.deleted",
  "subscription.renewed",
  "subscription.expired",
  // Invoices
  "invoice.created",
  "invoice.updated",
  "invoice.deleted",
  "invoice.paid",
  "invoice.sent",
  // Payments
  "payment.recorded",
  "payment.failed",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_EVENT_GROUPS = [
  "customer",
  "product",
  "plan",
  "subscription",
  "invoice",
  "payment",
] as const;

export function isValidEvent(event: string): event is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(event);
}
