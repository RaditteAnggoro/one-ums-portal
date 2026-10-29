# Company governance, audit and workspace experience — 29 October 2026

Latest human request: admin-registered deployment/change history, per-company maintenance, comprehensive paginated/filterable access/change audit (10/30/50/100), consistent bilingual statuses, company/user/role-level isolation, resizable/sidebar scroll persistence, richer user work information, GitHub login-page references and understated owner attribution (Raditte Anggoro).

Implement:

1. Company-scoped releases with typed change items, deployment/environment/version metadata and append-only status/correction history; registration restricted to company administrators.
2. Maintenance blocks non-admin login/API access and incoming work; tenant admins remain able to disable it. Stop starting queued/scheduled work while enabled; preserve reservations and explicit missed-schedule recovery.
3. SQL-side audit paging, date/action/business-menu filters, actor/IP/correlation and redacted field changes. Extend semantic events with database metadata change capture for business configuration and entities; no passwords/keys/message/recipient contents in row snapshots.
4. A single status-label dictionary for Indonesian/English without translating user-authored data. Stable workspace shell/scroll across route changes; persisted adjustable width, visible pointer/keyboard resize separator, independent collapse and mobile behaviour.
5. Company corporate ID and user employee ID/department/job title/work phone plus role level. Levels are organizational metadata; permissions and approval-stage membership remain explicit, not implied by a higher number. Validate all role/team assignments against the company.
6. Recommend and implement a restrained login using the current design system, with source references/credits. Keep real functionality only; optional demo account controls are disabled by default in production.
7. Non-intrusive author metadata/source and About attribution, no tracking calls, watermark execution or hidden access mechanisms.

Retain previous seven-point SaaS/generic-provider/WA lifecycle work as outstanding scope in docs/saas-hardening-plan.md. Verify tenant access, maintenance recovery, change capture/redaction, audit paging/date boundaries, user details, status languages, sidebar pointer/keyboard/scroll, login and regression workflows. Current app/DB may contain synthetic demonstrations; do not send real messages or deploy externally.
