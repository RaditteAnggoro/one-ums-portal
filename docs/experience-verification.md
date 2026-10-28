# Bilingual experience and server packaging — verification

28 October 2026. This increment implements the latest eight-point UI/administration/documentation request. It does not complete every item in the original messaging-platform product brief.

## Implemented and checked

| Request | Implementation | Evidence |
| --- | --- | --- |
| Overlapping controls | Notification time/actions wrap with explicit gaps; scrolling modal; responsive header and explorer controls | Browser bounding-box check at 1024/390 px; mobile document overflow assertion; images inspected |
| Indonesian / English | Shared catalog, account preference, login/header language, dates/numbers, notifications and manual; author-supplied content preserved | Translation unit cases; English login, saved language across reload, bilingual guide, existing Indonesian journeys |
| Deployment-neutral UI | Workstation banner removed; optional environment label; runtime same-origin API proxy | UI source review, browser rendering and production HTTPS proxy check |
| Installation/migration/credits | Dockerfile, Compose, split worker, migration-only and first-operator commands, Kubernetes examples, English/Indonesian guides, credits | Fresh container DB migration/bootstrap; image build; runtime health/HTTPS; Kubernetes client dry-run |
| Push notifications | Opt-in operational browser push; encrypted subscriptions; preference/device controls; durable dispatch; session/scope check before display; acceptance vs display distinction | Injected transport and service-worker tests; invalid/cross-company tokens, revoke, UNKNOWN no automatic retry, HTTP410 expiry; disabled configuration browser case |
| Dropdowns | Radix single select plus checkbox multi-selection; native form values/validation; portals, keyboard controls | Form submissions, filters/themes; keyboard open/select/Escape retains parent form |
| Company onboarding | Separate platform-administrator gate, initial owner/team/roles/two-stage policy/zero budget, audit | Tenant admin denied; platform creation and isolated owner; credential-redaction and budget assertions; browser creation |
| User guide | 19 bilingual role-filtered topics with menu navigation/search and capability boundaries | Article-language unit check, search/reload/navigation browser case |

## Recorded checks

- `pnpm test`: **47 passed in 5 files**, using real PostgreSQL and Redis for application boundaries; latest run 5.72 seconds. Browser push sender is injected, not a live third-party service.
- `pnpm test:e2e`: **16 passed in 46.6 seconds** with Chromium against the compiled application. Covers existing approvals/revisions/scheduling/budgets/roles/themes plus the new experience. Synthetic campaigns only.
- `pnpm typecheck` and `pnpm build`: passed. This is the pinned project toolchain, not a compatibility claim for every Node/browser release.
- `docker build -t one-ums-portal:verification .`: passed using OrbStack. Image runs as UID1000; production dependency installation excludes development packages.
- Isolated Compose project `ums-verification`: fresh PostgreSQL/Redis volumes, migration and bootstrap, separate API/worker/web, health200. Self-signed HTTPS test reverse proxy: production login, secure HttpOnly session, platform company menu, zero browser errors.
- `kubectl create --dry-run=client --validate=false -f deploy/k8s -o name`: passed for the example resources. **No cluster resources applied**; this checks client parsing, not server admission, ingress, storage or production availability.
- Representative light/dark contrast checks from browser suite pass; notification/mobile/dashboard images visually inspected. No claim of a complete WCAG audit.

Machine-specific logs/screenshots are retained in the ignored implementation artifacts rather than committed with source. Test containers are isolated from the running development database and are removed after verification. No deployment to an external server, actual vendor message, paid service, manual quota reset or public publication was performed.

## Material boundaries

Web Push currently targets internal approval/budget/execution notifications. It is OFF by default, needs operator-managed VAPID and HTTPS, and has not been verified against live browser push services or every mobile OS. Customer push campaigns are a separate future channel. Push-service acceptance and browser display do not prove human reading.

Generic real vendor transport/callbacks, consent/suppression, provider invoices, visual workflow publication and some broader product capabilities remain unfinished. See [product review](product-review.md), [deployment guide](deployment-en.md), and the original project acceptance criteria. No new throughput benchmark was run for this UI/deployment increment; historical dispatcher results are not whole-application capacity guarantees.
