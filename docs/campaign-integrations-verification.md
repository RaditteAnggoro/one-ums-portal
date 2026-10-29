# Campaign and integration management — verified increment

29 October 2026. Scope: latest five user requests. Previous broader SaaS/real-vendor/Meta work remains active.

| Request | Delivered behaviour | Checks |
| --- | --- | --- |
| Visible demo users | Five role buttons, two demo companies, credentials populated on selection; local portfolio build explicitly enabled | Browser role count, second-company email and mobile overflow/screenshot. Production builds require explicit opt-in; no demo bootstrap in production |
| Dynamic parameters | Parse placeholders from selected template bodies; cards show names/count; only active fields and mappings submitted; inline versioned template creation;0/1/2/3-parameter examples | Domain variable extraction, browser switching3→1→0→3 and rendered values; immutable template/approval regressions |
| Explicit recipients/new channels | Per-channel destination column mapping or direct single-recipient capture as an immutable team dataset; email/phone/Slack/Telegram/Push validation; per-channel preview in campaign details | Real API/queue checks for three new channels and malformed/wrong-tenant cases; manual email+Push browser campaign |
| Provider/account/sender/rates | Forms above lists; structured endpoint/method/auth/header/body/response-path; template JSON preview and nested variable mappings; new config/account versions; channel sender IDs and typed metadata; encrypted API/bot/custom credentials; partial rotation and explicit clear; currency/effective-dated rate cards with admin FX-to-IDR | Browser generic definition validate/publish/account/USD workflow; prototype/header restrictions; unchanged historical secrets, secret non-disclosure, quoted USD cost16.4000 IDR and rate reference |
| Natural terminology | Familiar Provider, Account & sender, Rate card, API key, Template, Preview and parameter wording alongside ordinary Indonesian workflow instructions | Bilingual existing journeys plus25-topic role-aware manual, screenshots and label/form checks |

## Evidence

- `pnpm test`: **59 passed in5 files,7.31s**, real PostgreSQL/Redis with app worker stopped.
- `pnpm typecheck` and compiled `pnpm build`: passed; web build reads the ignored demo opt-in configuration.
- `pnpm test:e2e`: **27 Chromium workflows passed in1.2m**, including3 new cases and all24 prior cases. The initial run found missing recipient previews/JSON accessible names and an obsolete Push-placeholder expectation; fixes were followed by a full passing run.
- Targeted new browser file:3 passed in7.1s. Demo mobile, dynamic campaign and provider-rate screenshots inspected.
- Migration019 applied successfully to the existing database. Existing versions/data retained; synthetic examples added idempotently to the two development demo companies.
- A final CSS-only fix keeps demo-company dropdown layout independent of the role-button layout; build and targeted demo check repeated afterward.

This increment does not claim a fresh19-migration container test, external deployment, live provider/Meta validation, live FX feed or independent security assessment. The prior container verification covered18 migrations and predates this code.

## Boundaries and next work

All six outbound channels use the simulated provider path. Configuring HTTP, publishing its definition and storing encrypted credentials does not enable live transport; explicit vendor adapter/security/sandbox verification is still required. Customer Push destination tokens/aliases are independent from internal browser-notification subscriptions. Destination validation checks shape, not remote membership, consent or token ownership.

Quotes use their original currency and explicit immutable rate-card FX; internal budget/ledger settlement is IDR. A recurring run re-evaluates its effective rate within the approved spending ceiling and retains the rate ID used. No vendor invoice reconciliation is claimed.

API configuration, account versions and pricing changes remain company scoped and audited. Secrets are not returned on listing; partial rotation retains other keys. The broader SaaS hardening plan still includes real HTTP/callback contracts, WhatsApp provider→Meta template approval lifecycle, shared abuse limits, consent/retention and remaining SQL pagination.

References used for destination semantics: [Slack chat.postMessage](https://api.slack.com/methods/chat.postMessage), [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage), [Firebase single-device messaging](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk). These references do not establish a verified integration.
