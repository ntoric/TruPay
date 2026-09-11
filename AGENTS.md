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
- Schema: `prisma/schema.prisma`. Models: User, Customer, Plan, Subscription, Invoice, InvoiceItem, Payment, NotificationRule, NotificationLog, Settings + NextAuth tables.

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

### Notes
- `.env` contains `AUTH_SECRET` placeholder — set a strong secret in production.
- Settings (SMTP/SMS/Telegram/company) are per-user, configured in the Settings UI.

