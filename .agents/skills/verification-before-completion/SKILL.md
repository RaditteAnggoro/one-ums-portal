---
name: verification-before-completion
description: "Check evidence before reporting a coding change as complete, fixed, or passing. Use at implementation handoff or on a verification request."
---

# Verification Before Completion

Make the completion claim no broader than the observed evidence. This workflow complements implementation; it is not a separate approval gate.

## Match evidence to the claim

Choose checks from the repository's documented workflow, manifests, CI, and changed behaviour. Inspect commands when their side effects are unclear.

| Claim | Relevant evidence |
| --- | --- |
| A bug is fixed | The original failing scenario now succeeds; a meaningful regression test covers it where practical. |
| Tests pass | The named test run completed with its actual counts and result. |
| Build succeeds | The relevant build completed successfully. Lint alone does not establish this. |
| UI works | The requested interaction and resulting state were exercised; static review alone is narrower evidence. |
| Performance improves | Comparable measurements with a stated workload and environment. |
| Requirements are implemented | Acceptance criteria are mapped to behaviour and checks, including disclosed gaps. |

For text or other low-impact edits, inspect the final change and relevant rendering or syntax when applicable. Do not invent an automated test simply to satisfy this skill.

## Run and interpret

Use results from the final relevant code state. Existing results from this turn remain valid if subsequent edits cannot affect them. Repeat checks only when new changes or concerns invalidate the evidence.

Run the required relevant commands, wait for completion, inspect output and exit status, and distinguish pass, fail, blocked, and not run. Do not count skips, unavailable services, or a still-running check as a pass. A failing test present before the change still limits a claim that the suite is green.

Inspect the final diff for accidental edits. When delegated work was used, inspect the produced files and relevant checks; a status message alone does not verify the work.

Fix failures introduced by the requested change when authorized, then rerun the affected check. Do not weaken checks or expand into unrelated repair work to create a clean report.

## Handoff

Give the result and a concise evidence statement: command or interaction checked, result, and material gaps. If the environment prevents a check, explain the blocker and the remaining action precisely. Do not describe code as deployed, secure, compatible, or fully tested on the strength of a narrower check.
