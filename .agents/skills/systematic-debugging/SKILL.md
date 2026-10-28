---
name: systematic-debugging
description: "Investigate reproducible bugs, failing tests, build failures, or unexpected behaviour using evidence and focused experiments."
---

# Systematic Debugging

Identify what causes the observed failure before selecting a fix. Scale the investigation to the problem: a clear error may need one focused check; intermittent behaviour may need instrumentation.

## Establish the failure

Record expected and actual behaviour, a minimal triggering input or sequence, the environment, and the first relevant error. Reproduce using the project's existing tooling when available. Inspect the failing assertion and complete relevant stack trace.

If reproduction is unavailable, inspect the supplied evidence, state the limitation, and investigate independently where possible. Ask only for the missing information that prevents progress. Label any proposed fix as unverified until the original failure can be tested.

## Locate the cause

Trace the faulty value or state through callers and boundaries. Compare a working path and inspect recent relevant changes. Distinguish application logic, configuration, dependency, and environmental failures.

For diagnosis-only work, use existing logs, read-only inspection, or isolated scratch experiments without editing repository source or configuration. When code changes are authorized, add narrow temporary instrumentation if a boundary is uncertain. Capture field names, types, timing, and redacted identifiers as needed; do not print credentials or complete sensitive payloads. Avoid permanent instrumentation unless it serves the requested fix.

## Test a hypothesis

State a concrete explanation and the observation that would confirm or reject it. Use a small experiment that isolates the relevant variable. Read the result before changing the explanation. Preserve useful evidence and remove temporary changes that no longer serve the task.

When attempts keep failing, stop stacking patches. Revisit the reproduction and assumptions, seek another explanation, and report what each experiment ruled out. Do not declare an architectural flaw merely because several attempts failed. Escalate a decision only if the required change exceeds the user's requested scope.

## Resolve within scope

A diagnosis-only request ends with the supported cause, evidence, and fix direction. A request to fix includes the necessary implementation and verification without another routine confirmation.

For a fix, reuse a test that captures the regression or add a focused case when coverage is missing. Implement at the responsible boundary and rerun the original reproduction plus affected neighbouring checks. Use synchronization or a controlled clock for timing failures rather than arbitrary sleeps.

Report cause, change if authorized, reproduction result, and any remaining uncertainty. Treat a failed reproduction due to missing dependencies as blocked evidence, not proof that the bug is fixed.
