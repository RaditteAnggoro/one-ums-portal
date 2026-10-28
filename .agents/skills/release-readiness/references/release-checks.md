# Select relevant release checks

Use this list to choose checks for the actual change. It is not a requirement to run every category for every release.

| Area | Questions and evidence |
| --- | --- |
| Code identity | What revision and working changes are being assessed? Does existing CI apply to that state? |
| Build and tests | Did required checks finish for affected code? Are failures, skips, and missing services disclosed? |
| Contracts | Are API, event, file-format, or client changes compatible with deployed consumers? What tests support this? |
| Data migration | Are ordering, lock duration, backfills, constraints, and mixed-version operation considered? Is representative data or size evidence available? |
| Configuration | Are new variables documented, defaults intentional, and required configuration detected? Do not print secret values. |
| Dependencies | Did a lockfile or runtime requirement change? Do available project scans identify unresolved issues? Do not equate an unrun scan with a clean result. |
| Runtime | Do readiness checks, timeouts, retries, background jobs, and shutdown behaviour matter to this change? |
| Observability | Can the changed behaviour and its failures be identified without logging sensitive payloads? |
| Rollout | Can old and new versions coexist? Do changes need staged enablement or another dependency first? |
| Smoke test | What small interaction proves the changed behaviour after deployment, using approved test data? |
| Rollback | Can code be reverted without losing data? Do schema changes or external actions require recovery instead? |

Use disposable local fixtures for migration rehearsals. A production-like migration result still does not establish real production lock time without comparable data and load.
