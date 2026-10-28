# One UMS Portal

A local-first Unified Messaging System for campaign delivery, sequential approvals, operational investigation, and cost-centre budgets. Built with TypeScript, Next.js, NestJS, PostgreSQL, and Redis/BullMQ.

The interface follows a purple enterprise workspace: grouped navigation, light/dark/system themes, compact tables, message investigation drawers, and separate operations and finance views. Existing business forms use Bahasa Indonesia.

**Default delivery is simulated.** Email, SMS, and WhatsApp exercise the real local queue and financial ledger without sending external messages. This is an ongoing portfolio project; real provider transport, invoice matching, and visual workflow publication are not implemented yet.

## Features

- Company/team isolation and server permissions, cookie sessions, password changes, audit records, profile pictures.
- CSV/XLSX/JSON data, versioned templates, mapped variables and previews, incoming idempotent data APIs, manual authenticated HTTPS retrieval.
- Configurable sequential approvals, no self-approval, frozen submissions, return/revision/reapproval, stale-review protection.
- Immediate, one-time and recurring schedules; missed-run decisions, pause/cancel and interrupted-run recovery.
- Real PostgreSQL outbox and Redis/BullMQ processing, durable message/attempt/event timelines and uncertain-outcome reconciliation.
- Exact-decimal budget reservations, releases, spending, topups and ledger exports; monthly/quarterly/half-year/year periods.
- Message Explorer with server filters and cursor pagination; masked recipients and restricted/audited payload access.
- Operational dashboard, observed channel metrics, internal vendor usage, saved personal widgets and layouts.
- Versioned vendor definitions/accounts and encrypted credentials. Generic HTTP mapping configuration exists; actual generic sending/callbacks remain unfinished and real-account activation is rejected.

## Local setup

Requires Node.js 24+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
```

Copy `.env.example` to `.env` to override local configuration. With Docker installed, use `docker compose up -d` for PostgreSQL, Redis and optional Mailpit. Mailpit's interface is at http://127.0.0.1:8025; its SMTP adapter is not wired yet.

Without Docker, keep separate terminals open:

1. `pnpm infra:local` — native PostgreSQL on port 54329, persisted under `.data/postgres`.
2. `pnpm infra:prepare-redis` — one-time checksum-verified Redis core build; requires make and a C compiler. Alternatively supply `REDIS_BINARY`.
3. `pnpm infra:redis` — Redis on port 63799 with AOF, a 256 MB ceiling, and no eviction.
4. `pnpm db:setup` — apply migrations and seed synthetic demo data.
5. `pnpm dev` — frontend at http://127.0.0.1:3000 and API at http://127.0.0.1:4100.

For a compiled local run, stop development, run `pnpm build`, then `pnpm start`. Both modes share Next's build directory.

### Demo accounts

Use `creator@demo.local`, `approver@demo.local`, `finance@demo.local`, `admin@demo.local`, or `viewer@demo.local`. Initial password: `LocalDemo123!`. Set `DEMO_PASSWORD` before the first seed to change it. Seeding does not overwrite existing passwords. A second isolated company uses matching accounts at `other.local`.

Create and submit a campaign as creator, approve the first stage as approver and the second as finance, then investigate its simulated results in Message Explorer. Synthetic contacts intentionally include delivered, failed and uncertain outcomes. Unknown acceptance retains the reservation and does not blindly resend.

Local schedules require the computer and services to stay running. Expired unstarted work becomes missed; replay/rescheduling and interrupted-run recovery require explicit decisions.

## Screens

| Route | Purpose |
| --- | --- |
| `/dashboard` | Logical-message KPIs, volume, channel performance, exceptions, personal widgets |
| `/messages` | Cursor-paginated message search and investigation drawer |
| `/deliveries` | Queue and uncertain-state investigation |
| `/channels` | Observed channel metrics, explicit simulator/no-observation labels |
| `/workflows`, `/approvals` | Existing campaign definitions and sequential approval workflows |
| `/templates`, `/sources` | Template versions, imports, incoming/REST connections |
| `/finance/usage` | Internal estimates and ledger spend by vendor/channel/team |
| `/finance/allocation` | Cost-centre budgets, topups, ledger/export |
| `/finance/reconciliation` | Unconfirmed local outcomes; provider invoice matching is unavailable |
| `/settings/providers` | Vendor configurations, encrypted accounts, rates |
| `/settings/applications`, `/settings/audit` | Company administration, approvals, profile and audit |

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
PLAYWRIGHT_BROWSERS_PATH=.runtime/browsers pnpm exec playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=.runtime/browsers pnpm test:e2e
pnpm benchmark
```

Integration tests require migrated PostgreSQL and Redis. Stop the application before running them to avoid competing workers. Browser tests and benchmark require the application running and use synthetic local records. The 10k benchmark consumes simulated budget, never real money.

The dashboard counts logical messages separately from attempts. Delivery rate is confirmed deliveries divided by all requests in the selected creation period, including processing/unknown. Financial estimates, internal ledger spending, provider reports and invoices are distinct. Missing vendor data is not displayed as zero or healthy.

See [verification evidence](docs/verification.md), [UI implementation and limitations](docs/ui-implementation.md), [design specification](docs/ui-ux-specification.md), and the original [product brief](project.md). Local continuation records and browser traces stay outside Git. Repo-local development skills remain in `.agents/skills`.

## Boundaries

Default local development uses no paid SaaS. Actual provider traffic or future hosting may have separate costs. No deployment or real vendor sends are configured. Keep environment files, databases, runtime downloads and encryption keys out of Git; production requires separate secrets and operations setup. Review upstream licenses before redistribution/deployment.

Remaining product work includes real generic/provider transport and authenticated callbacks, dynamic recurring data/REST pagination, richer import diagnostics, full account recovery/editing, WhatsApp vendor-template metadata, advanced workflow orchestration and invoice reconciliation, and broader restart/timezone exercises. Do not infer production capacity or accessibility certification from targeted local checks.
