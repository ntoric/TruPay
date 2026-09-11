<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project: SubHub — Subscription & Membership Manager

### Tech stack
- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind v4
- PostgreSQL via Prisma 6 (`prisma-client-js` generator, imports from `@prisma/client`)
- NextAuth.js v4 (credentials provider, JWT sessions, Prisma adapter)
- Docker (docker-compose: postgres:16 + app)

### Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` — production build (Turbopack)
- `npm run lint` — eslint
- `npx prisma migrate dev` — create/apply migrations
- `npx prisma generate` — regenerate client after schema changes
- `npm run db:seed` — seed demo data (login: demo@subhub.app / password123)
- `docker compose up -d` — run postgres + app in Docker

### Database
- `DATABASE_URL` in `.env` points at the dockerized Postgres on host port 5435 (internal 5432).
- Schema: `prisma/schema.prisma`. Models: User, Customer, Plan, Product, Subscription, Invoice, InvoiceItem, Payment, NotificationRule, NotificationLog, Settings, ApiKey, WebhookEndpoint, WebhookDelivery + NextAuth tables.

### Next.js 16 conventions used here
- `params`/`searchParams` in pages and route handlers are **Promises** — always `await` them.
- `cookies()`/`headers()` are async.
- Auth gate lives in `src/proxy.ts` (renamed from `middleware.ts`).
- Server Actions use `'use server'`; pass id-parameterized actions to client components via `.bind(null, id)` (NOT arrow closures).
- Tailwind v4: `@apply` cannot reference other custom component classes — repeat base utilities in grouped selectors.

### Notification system
- Providers: `src/lib/notifications/{email,sms,telegram}.ts` (SMTP via nodemailer; pluggable SMS via Twilio/Vonage; Telegram via grammy).
- Dispatch + logging: `src/lib/notifications/dispatch.ts`.
- Scheduler + maintenance: `src/lib/notifications/{scheduler,maintenance}.ts`, triggered by `GET /api/cron/process?token=<AUTH_SECRET>` (set up an external cron hitting this URL daily).
- Telegram management webhook: `POST /api/telegram/[token]/webhook` — set the webhook via the Telegram Bot API.

### Cashfree payments & reconciliation
- Flow: create-order (web `/api/payments/cashfree/create-order` or mobile equivalent) → Cashfree checkout → status recorded via webhook (`/api/payments/cashfree/webhook`) and/or client verify (`/api/payments/cashfree/verify`). `src/lib/payments/cashfree.ts` = gateway client; `cashfree-config.ts` loads per-user creds from Settings; `process-payment.ts` = idempotent recorder (`recordCashfreePayment`).
- **PENDING placeholders**: every create-order (web + mobile + auto-renewal) stores a `Payment` row with `status=PENDING`, `gateway=cashfree`, `cashfreeOrderId` set, so the order is trackable. When a COMPLETED payment is recorded, the placeholder is deleted inside the same transaction (single-point cleanup in `recordCashfreePayment`).
- **Reconciliation** (webhook-miss safety net): the webhook is unreliable if the system is unreachable. `src/lib/payments/reconcile.ts` → `reconcileCashfreePayments()` runs as the **first** step of the cron endpoint and polls the Cashfree API for every PENDING cashfree order (last 30 days, max 200/run): SUCCESS → record payment (idempotent, marks invoice PAID, fires `payment.recorded`/`invoice.paid` webhooks, removes placeholder); FAILED/USER_DROPPED → mark FAILED + `payment.failed` webhook; still PENDING and older than 7 days → mark FAILED (order expired) + `payment.failed`; otherwise leave for the next run. Per-user Cashfree config is loaded once per batch; per-order errors are isolated.

### External integrations (public API + outbound webhooks)
- **Public REST API** (read-only, for external systems): `src/app/api/v1/*`. Auth via Bearer API key (`Authorization: Bearer shub_...`). Endpoints: `/api/v1` (info), `/dashboard`, `/reports`, and list+detail for `customers`, `products`, `plans`, `subscriptions`, `invoices`, `payments`. Supports `limit`/`offset` pagination and `status`/`customerId`/`active`/`search` filters where relevant. API-key auth + helpers live in `src/lib/api-auth.ts`. `/api/v1` is whitelisted as a public path in `src/proxy.ts`.
- **API keys**: managed in Settings → API Keys. Full plaintext shown once on creation; only the sha256 hash + a display prefix are stored. Server actions: `src/app/actions/api-keys.ts` (create/revoke/delete).
- **Outbound webhooks**: push signed event payloads to user-registered endpoints. Event catalog: `src/lib/webhooks/events.ts`. Dispatch + HMAC-SHA256 signing + delivery logging: `src/lib/webhooks/dispatch.ts`. Payloads are signed with `x-subhub-signature` (hex HMAC of raw body using the endpoint secret); also sends `x-subhub-event`, `x-subhub-timestamp`, `x-subhub-delivery` headers. Each delivery is recorded in `WebhookDelivery` (status/response/retry). Dispatch is hooked into the create/update/delete/renew actions for customers, products, plans, subscriptions, invoices, payments (manual + Cashfree), plus the maintenance job (auto-renew + expiry).
- **Webhook config UI**: Settings → Webhooks. Server actions: `src/app/actions/webhooks.ts` (create/update/toggle/delete + retry delivery). Endpoint URLs must be https; events list is comma-separated (blank = all).

### Notes
- `.env` contains `AUTH_SECRET` placeholder — set a strong secret in production.
- Settings (SMTP/SMS/Telegram/company) are per-user, configured in the Settings UI.

