# Bilingual UMS experience and deployment increment

User request (28 October2026): fix notification/toolbar overlap; Indonesian/English throughout; remove workstation/local branding; prepare server deployment and database migration guides; ethical credits; develop push; review Novu/Courier/Brevo user use cases; improve selects; add company onboarding; provide an in-app manual.

Implementation order:
1. Shared i18n catalog/provider and persisted user language, accessible select primitive, overlap/responsive fixes, deployment-neutral copy (retain truthful provider capabilities in administration).
2. Platform-only company onboarding with company-scoped initial users/roles/policy/budget and audit; no cross-company operational permission granted to tenant admins.
3. Opt-in browser push, encrypted scoped subscriptions and durable notification outbox, subscription preferences and safe server configuration. Provide push campaign capability where it can be verified; distinguish browser acceptance from delivery.
4. Searchable bilingual role-aware user manual and product comparison/priority map based on official Novu, Courier and Brevo documentation; ethical product/design/library credits.
5. Separate migration from demo seeding, secure first-operator bootstrap, configurable server runtime, Docker/Compose and Kubernetes examples plus backup/restore/migration/rollback instructions. Test isolated container setup if OrbStack is available; do not deploy into existing clusters or external servers.
6. Type/API/browser/visual verification, including both languages, tenant authorization, push opt-in/expiry, dropdown keyboard behavior and overlap at narrow widths. Record material limitations honestly. Preserve private GitHub repository and never include keys/runtime/data.

The UI task does not authorize sending campaigns to real external recipients, purchasing services, or deploying to production. Use simulator/test transport by default. Existing user permission to develop continuously after ordinary quota reset persists.
