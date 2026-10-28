---
name: research-plan-implement
description: "Research and execute a complex change across modules or sessions with a resumable local plan. Use for substantial migrations or multi-stage features, not small fixes."
---

# Research, Plan, Implement

Maintain enough evidence and state to carry substantial work across sessions. Follow the user's current stage: research only, plan only, implement an existing plan, or complete the full change. Do not infer implementation authorization from a request for analysis.

## Locate current state

Read applicable project instructions, the named plan or handoff, and the relevant current code. Check branch and working changes where Git exists. Verify that saved statements still match the files; a prior report is not proof of the current state.

Reuse the project's planning conventions. For authorized implementation or a request for saved planning records, use `.agents/artifacts/<task-slug>/plan.md` and `handoff.md` if no durable location exists. Choose a new slug for unrelated work and preserve existing artifacts. For research-only or plan-only requests without saved documents in scope, return the plan and handoff information in chat. Do not create these files for a short fix.

## Research and plan

Trace affected components, public contracts, persistence, and integration boundaries. Record code locations, facts, assumptions, unresolved decisions, and the smallest coherent design. Avoid a full repository survey when only one subsystem matters.

Break implementation into increments that can be exercised end to end. State each increment's outcome, dependencies, likely files, and verification. Use actual project commands when known; mark unknown commands as unresolved instead of inventing them. Account for compatibility and data migration where needed.

## Execute or resume

When implementation is requested, complete ready work within the authorized scope. Use the plan to guide delivery, revising it when code evidence changes a routine technical choice. Surface decisions that change the intended product or external effects. Do not ask to approve each already-authorized step.

Preserve user changes. Keep independent tasks separate if using agents; delegate only when tools are actually available and inspect their output. Do not automatically create branches, worktrees, chats, commits, or external tickets.

## Keep a useful handoff

When saved records are in scope, update the plan and handoff at meaningful milestones or before stopping, using [handoff-template.md](references/handoff-template.md) as a compact shape. Otherwise include the relevant record in chat. Include exact checks and remaining work, not a transcript of the conversation. Keep credentials and private payloads out of artifacts.

On resumption, verify the recorded environment and code state, complete remaining authorized work, and check the original acceptance criteria. A plan file is not completion evidence.
