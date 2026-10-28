---
name: lean-senior-engineering
description: "Implement small, complete code changes using existing project patterns. Use for features, fixes, refactors, code reviews, or technical-debt reviews."
---

# Lean Senior Engineering

Deliver the requested behaviour with as little additional complexity as the codebase allows. Explicit user requirements and repository conventions take precedence over this skill. Minimum code means a complete, readable solution, including affected callers and tests.

## Choose the change

Inspect the affected code, callers, and nearest tests. Expand the search only as dependencies require. Account for configuration, fixtures, exports, and contracts that must change with it.

Prefer the first adequate option:

1. Existing behaviour or configuration that already solves the request.
2. An existing project helper, component, service, or pattern.
3. A standard library or native platform feature, when it fits project conventions.
4. An already installed dependency.
5. A small, direct implementation.
6. A new dependency or abstraction, only when it solves a demonstrated need.

Readable code and correct behaviour outrank line count. Preserve validation, useful error handling, accessibility, compatibility, and data integrity. Avoid new options or extension points for hypothetical future features.

## Work at the requested level

Use `full` by default. Honour a level requested in plain language for the current conversation; do not claim a persistent setting was saved.

- `lite`: implement the user's chosen approach; mention a materially simpler option briefly when useful.
- `full`: choose the smallest complete approach within the request.
- `ultra`: challenge costly assumptions with concrete alternatives before substantial work; the user's explicit choice still wins.
- `off`: stop applying this skill's preferences, retaining normal project instructions.

## Implement and check

For a fix, establish the failing behaviour and inspect other callers of the changed code. For a feature, identify acceptance criteria before implementation. Do not turn clear, small requests into a design interview.

Use short feedback cycles. Add focused behaviour tests for meaningful logic or regression risk. Read [test-design.md](references/test-design.md) when choosing test boundaries, using mocks, or writing a regression test. Low-impact text or styling edits need proportionate inspection, not artificial tests.

Run relevant existing checks after the final change. Report their actual scope and outcome. Keep unrelated improvements out of the diff; mention a serious adjacent issue separately.

## Review, audit, and debt requests

Read [review-and-debt.md](references/review-and-debt.md) for reviews, audits, and debt inventories. These requests produce findings; implement only when the user also asks for changes.

## Finish

Lead with the result. Include a short verification statement and material gaps. Never invent test execution, performance gains, token savings, or an independent review. A requested implementation is complete only when the requested behaviour and necessary checks are addressed or a concrete blocker is reported.
