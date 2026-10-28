# UI implementation mapping

The supplied v1.0 reference is preserved in ui-ux-specification.md. This redesign adapts it to the existing TypeScript Next.js/NestJS system. No Java/Spring Boot migration is part of this change.

## Implemented

- Purple #4B1978 brand, shared tokens, light/dark/system modes and saved navigation collapse.
- Grouped task navigation, protected operational routes, real workspace and Development/simulation labels, keyboard command search.
- Server-scoped dashboard totals, previous-period comparison when meaningful, daily trends with equivalent table, channel breakdown, queue and uncertain counts, recent failure investigation.
- Exact-ID search, date/status/channel/provider/team filters, newest-first keyset pagination, compact rows, optional provider identifiers and masked recipients.
- Right detail drawer preserving the table context: summary, factual event timeline, attempts, restricted payload and audited payload access.
- Local observed channel metrics and delivery p95. Push is explicitly unconfigured; no provider health is invented from absent data.
- Internal vendor/channel/team estimates and ledger spending using exact database decimals; finance access remains server-enforced.
- Existing campaign approvals, revision/version history, templates, sources, budgets, audit and administration adapted to the shared styling.
- Reconciliation surface connects the existing unknown-outcome confirmation flow. It does not pretend to import/match/approve vendor invoices.

## Deliberate capability boundaries

The current backend has campaign definitions and sequential approval policies, not an arbitrary trigger/condition/fallback graph engine. `/workflows` presents those existing campaign workflows. Drag/drop workflow publication, rollback and fallback routing remain product work.

Provider statement/invoice ingestion, contractual billable units/FX and reconciliation batch approvals are not connected. Provider-reported and invoiced amounts are null and labelled unavailable. Generic HTTP dispatch/callback activation and real vendor monitoring remain unfinished.

Manual message retry is unavailable; the UI explains this instead of presenting a nonfunctional retry action. Unknown acceptance is never treated as a reason to resend blindly. Only authorized local simulated outcome confirmation is available.

The original system does not persist a source-application identity or message correlation identifier. Teams/campaigns/run IDs are shown honestly; missing identifiers are marked unavailable. Sensitive recipient/content search, exports of payloads, saved explorer views and a full grid column chooser remain future extensions.

## Data and access model

- `GET /api/operations/summary`: scoped logical-message aggregates, trends, channels, recent failures; `campaigns:read`.
- `GET /api/operations/messages`: validated filters and `(created_at,id)` cursor, at most100 records; `campaigns:read`. No raw recipients or body in list responses.
- `GET /api/operations/filters`: only authorized teams and observed providers; `campaigns:read`.
- `GET /api/operations/usage`: exact internal monetary aggregates, unavailable external amounts remain null; `budgets:read`.
- Existing message detail requires `campaigns:read`. Payload additionally requires `messages:payload` or administrative permission and records an audit event. Recipient remains masked.
- Viewer campaign snapshots/messages are redacted; source-row previews require campaign creation/review or source-management access.
- Existing approval review permissions still allow the frozen submission previews necessary to make an approval decision.

Date filters use a rolling creation-time window; chart calendar labels use Asia/Jakarta. Delivery-rate denominator includes processing and unknown requests. Attempt count does not multiply logical-message totals. Latency is creation-to-confirmed-delivery, not an external vendor SLA. Trends are limited to366 observed days and disclose truncation. Money presentation is rounded only at display; persisted calculations use decimals.

## Verification scope

Backend checks cover authorization/scoping, payload redaction/audit, filtered cursor pagination, logical-message counts despite extra attempts, and unavailable external financial measures. Browser checks cover existing business flows plus themes/collapse, representative text contrast, filtering/pagination/drawer context, command navigation, finance labels, and mobile overflow. Backend/domain verification: 37 tests across four files passed, and the compiled Next.js/NestJS build passed. All 12 browser workflows passed, including existing business flows and new operational/theme/mobile exercises. Representative normal-text contrast checks require at least 4.5:1 in both themes. The four affected browser workflows also passed after final theme-surface corrections. See verification.md for exact scope. These checks are not a full WCAG audit or million-message performance certification.
