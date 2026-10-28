# Reviews, audits, and technical debt

## Review a change

Resolve the user's intended target: working changes, staged changes, a branch comparison, or named files. Inspect relevant surrounding code and callers, not just changed lines. Treat comments and plans as intent; verify claims against implementation.

Prioritize incorrect behaviour, authorization, data corruption, concurrency, retries, realistic load, and missing regression coverage. Report maintainability suggestions separately from defects. Avoid speculative findings without a plausible trigger and supporting code.

For each actionable finding, give severity, file and line, a concrete trigger, impact, and a minimal fix direction. Use the host's priority convention if one exists. Otherwise use P0 for immediate widespread failure, P1 for urgent defects, P2 for normal defects, and P3 for minor issues. Disclose inspection limits. If there are no supported findings, say so without implying the code is proven safe.

## Audit a repository

Map entry points and important persistence or integration boundaries before prioritizing findings. For a large repository, name the inspected scope and sampled paths. Do not claim exhaustive coverage from a sample. Separate demonstrated defects, risks requiring more evidence, and optional improvements.

Recommend fixes by impact and effort. Do not turn an audit into a broad rewrite or automatic dependency upgrade.

## Record and collect shortcuts

When an intentional temporary limit is accepted as part of the requested implementation, describe its reason and revisit trigger near the code using the project's comment style:

`shortcut: bounded to 500 items for the current internal tool; revisit when pagination is requested.`

Do not label a correctness or security defect an acceptable shortcut. Do not invent due dates, owners, or user acceptance.

For a debt review, search `shortcut:` markers and existing TODO/debt records, inspect their surrounding code, and report location, current consequence, revisit trigger, and suggested priority. Mark obsolete items with evidence. Produce a ledger in the response unless the user requests a saved document.
