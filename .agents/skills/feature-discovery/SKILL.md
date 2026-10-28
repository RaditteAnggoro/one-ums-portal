---
name: feature-discovery
description: "Clarify an ambiguous feature or consequential design choice into acceptance criteria and an implementation outline. Skip interviews for clear small changes."
---

# Feature Discovery

Turn uncertainty that would change the implementation into concrete decisions. Respect existing decisions and the user's requested depth. A clear feature request does not need a compulsory interview.

## Investigate before asking

Read the request, applicable repository guidance, and the relevant existing flow. Identify which requirements are stated, which can be inferred from existing behaviour, and which choices materially affect the result. Reuse established terms; create a glossary only when repeated ambiguity makes one useful.

For consequential uncertainty, give the user a recommended default with its trade-off and ask a concise question. Continue independent inspection while awaiting a reply. Do not ask again for a decision already made. If the answer would only affect a reversible implementation detail, use a stated assumption and proceed.

## Describe the feature

Keep the specification proportional. For a small feature, a few lines in the conversation are sufficient. For larger work, use the repository's existing documentation location when a saved plan is requested or needed for execution.

Cover the user outcome, scope and exclusions, current behaviour, main flow, important error or empty states, and acceptance criteria that can be observed. Include API, data, migration, compatibility, or permission changes only where relevant.

Describe the smallest useful increment. Identify affected modules from code evidence, integration uncertainties, and verification. Present alternatives only if they change a meaningful property such as compatibility, deployment cost, or data ownership.

## Move into the requested work

If the user requested planning only, deliver the specification and unresolved decisions without implementing. If they requested a build or fix, proceed once decisions that block correctness are resolved. A mandatory design-signoff ritual is not implied.

Use a failing behaviour check and short implementation slices when adding logic. Measure success against the agreed acceptance criteria rather than the number of files or tasks produced.

Do not create issue-tracker tickets, update external documentation, or start another chat solely because this skill was invoked. Those actions require relevant user authorization.
