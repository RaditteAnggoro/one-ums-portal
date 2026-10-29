# Company governance and workspace experience — verification

29 October 2026. This increment addresses the ten-point governance/UX request. The broader SaaS/vendor work remains tracked in [the SaaS plan](saas-hardening-plan.md).

| Request | Implemented behaviour | Evidence |
| --- | --- | --- |
| Deployment/change history | Company-specific release register; version/environment/time/reference; typed fixes/enhancements/features/security/maintenance; admin-only registration; append-only status transitions and linked corrections | API role/company denial, invalid/stale transition checks; browser registration, deployment/rollback history and read-only viewer |
| Company maintenance | Admin-only switch/reason/notice; normal login/API sessions blocked; other companies unaffected; tenant admin recovery retained; queued dispatch/scheduler/incoming held | Real DB/queue checks and separate browser contexts; balances preserved during hold; maintenance notice shown at login |
| Access and change audit | SQL paging 10/30/50/100; date/module/action/search/source filters; actor/IP/correlation; safe field changes; business-entity and run/message-event/ledger triggers | Pagination and timestamp cutoff, actor correlation, secret exclusion, team ownership and finance masking regression cases; browser filter/details checks |
| Bilingual statuses | Shared labels from stable status codes, including final failure/unknown/holds and release states | Domain status cases and English Message Explorer badges/filter choices |
| Company users/roles | Tenant-validated assignments; explicit permissions and organizational role levels; seeded company levels; session revocation for role/access changes | Cross-company role/team denial, high-level read-only user denial, onboarding defaults and browser role assignment |
| Adjustable sidebar | Independent collapse and saved width 208–420px; visible drag grip and keyboard resize/reset; persistent root workspace | Browser pointer/keyboard/reload/collapse checks and actual DOM identity/scroll-position assertions |
| User work identity | Email/corporate ID/employee ID/department/job title/work phone; paged user administration and scoped edit UI | API validation/uniqueness/access tests; browser create/edit/profile checks |
| Navigation continuity | Workspace remains mounted across menu routes and private state is cleared on account change | DOM/scroll continuity and existing session-expiry/company-switch regression |
| Restrained login | Centred bounded form, empty initial credentials, reveal password and language selector; optional demo controls off by default | Browser empty-form/language/provenance checks; [official GitHub references](login-design-references.md) |
| Creator attribution | Raditte Anggoro in source/authorship/About and metadata; provenance RA.ONEUMS.2026.10 | Browser metadata/About checks and source inspection; no tracking or additional access mechanism |

## Checks

- `pnpm test`: **55 cases in 5 files passed**, real PostgreSQL/Redis, application worker stopped during integration tests. Final run 12.75 seconds.
- `pnpm typecheck` and `pnpm build`: passed on the current source. These must run sequentially: Next rebuilds generated type files during a build.
- `pnpm audit --prod --json`: **zero reported advisories**. This is dependency evidence, not an independent application VA/pentest.
- `pnpm test:e2e`: **24 Chromium workflows passed in 1.1 minutes** against the compiled application, covering the seven new governance cases plus the existing reporting, approvals, finance, sources, company onboarding, language, theme and mobile journeys. Earlier login timeouts occurred during a simultaneous container dependency installation; the final complete suite passed after that build finished, with no weakened assertions or longer test timeouts.
- `docker build -t one-ums-portal:verification .`: passed on final runtime source. An isolated Compose project with fresh volumes applied **all 18 migrations**, repeated migration successfully, bootstrapped the first platform operator and started separate API/worker/web processes. New roles have levels 99/30/20/10/1.
- Self-signed HTTPS verification passed: health200, successful production login, secure HttpOnly cookie, platform company menu and no browser errors. The verification proxy/containers/network/volumes were then removed; the native application/database were preserved.
- Sidebar, English status, filtered audit, release history and login screenshots were inspected. Supplemental mobile-dark login and English delivery-audit checks are retained in local evidence. This is targeted UI verification, not a complete WCAG audit.

## Operational boundaries

Maintenance permits company administrators to recover service. Requests already authorized and external work already started can finish; it is not a database backup freeze or a cancellation of a vendor-accepted message. Expired schedules still require an explicit rescheduling decision.

Audit metadata intentionally excludes passwords, API keys, credential ciphertext, source rows and full message/recipient contents. Finance amounts are masked unless the caller has budget-read permission. Team-owned finance/user records follow their target team, not the administrator's own team. Timestamp cutoffs reduce shifting pages but do not provide a long-running database MVCC snapshot; late-committing transactions can still affect results. Audit is append-only through application operations, not an externally certified tamper-proof archive.

Role levels do not grant authority by number; company/team permissions and approval-stage membership remain explicit. Release registration is a record of a deployment and does not execute one. About/metadata/source attribution supplies provenance and can be removed by someone editing the source; it is not a remote usage detector.

No real vendor sends, paid services, external server deployment, cluster changes or independent VA/pentest were performed. Generic vendor transport, WhatsApp registration/Meta lifecycle, broader all-list paging and SaaS security gaps from the preceding request remain active work.
