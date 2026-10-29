# Security review checkpoint — 29 October 2026

Scope: source review, tenant-boundary regression tests and production-dependency advisory audit. **No independent VA/pentest or security certification has been completed.** No external systems were scanned. See [the active SaaS plan](saas-hardening-plan.md).

Existing controls include server-side company/team permissions, masked recipient views and permission-gated/audited payload access, parameterized SQL, strict/HttpOnly cookies, origin/CSRF checks, password hashing, encrypted credentials, HTTPS production validation and allowlisted DNS-pinned external retrieval. These are individual controls, not proof of comprehensive security.

Confirmed gaps include process-local login throttling (not shared across replicas), missing MFA/account recovery, broad bootstrap/reference lists, no tenant retention/deletion policy, and incomplete real-vendor transport/callback contracts. Pagination and reporting fixes in the current increment cover operational messages/finance summaries, not every reference menu. A public SaaS rollout must resolve and test these gaps.

`pnpm audit --prod --json` reported one moderate advisory, [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), in ExcelJS's uuid8.3.2 dependency. The advisory concerns caller-supplied buffers in v3/v5/v6. The inspected ExcelJS call uses v4 with no external buffer, so that particular vulnerable call path has not been demonstrated here. The scoped override targets patched uuid11.1.1, retaining the CommonJS v4 API; install, XLSX conditional-formatting roundtrip,49 unit/integration cases and the compiled build passed. A repeated production-dependency audit returned zero reported advisories. This demonstrates remediation of this dependency finding, not a completed application VA/pentest.

## Required verification before external SaaS launch

- Build an ASVS5.0.0 control/evidence matrix with accountable owners. [OWASP ASVS](https://asvs.owasp.org/) is a verification framework; referencing it does not imply compliance.
- Exercise object/property/function authorization across companies and teams, including exports, credentials, callbacks and background jobs. Review [OWASP API risks](https://api-security.owasp.org/editions/2023/en/0x11-t10/).
- Introduce shared abuse limits for login/import/export/webhooks and provider execution; test exhaustion/recovery and proxy attribution.
- Add MFA/SSO strategy, key rotation/revocation, secret safe previews, signed timestamped callbacks with idempotency and replay protection, and non-sensitive monitoring.
- Classify personal data; define retention, deletion, consent/suppression, backup handling and scoped export approval. Keep original recipient content out of shared logs.
- Run dependency/static/secret scans in CI and DAST only against a dedicated owned test environment. Independently test business logic/tenant isolation before launch, then address findings and retest.
- Apply platform network restrictions/TLS, secret management, least-privilege database credentials, backup restoration and incident response. Avoid interpreting a clean dependency audit as a clean application VA.
