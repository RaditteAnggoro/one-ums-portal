---
name: release-readiness
description: "Assess a specified release for verification, compatibility, configuration, migration, smoke-test, and rollback gaps. Use on pre-release or readiness requests."
---

# Release Readiness

Assess the specified code state and environment. A readiness review does not itself publish, tag, deploy, merge, run a live migration, or change production configuration. Honour any separate explicit authorization for those actions.

## Establish the target

Resolve the requested branch, diff, revision, or working changes and intended environment. Record the revision and any relevant uncommitted changes. If the target is missing, review available local changes with a disclosed scope; do not invent a release identifier or assume production access.

Read existing release instructions, manifests, CI, migrations, and changed configuration. Use their real checks rather than prescribing a universal pipeline.

## Check what the release changes

Select relevant checks from [release-checks.md](references/release-checks.md). Inspect final-state test/build results. Execute safe, relevant local checks within the request. A command named `test`, `build`, or `dry-run` may still have external effects; inspect unfamiliar scripts before running them.

Distinguish existing defects from introduced regressions. Do not silently repair unrelated failures or waive a failing required check. If the user requested implementation too, fix introduced defects and rerun affected checks.

## Report a decision with limits

Use one of: `Ready for the assessed scope`, `Not ready`, or `Insufficient evidence`. State the code state and environment assessed, blockers ordered by impact, completed checks, and unverified checks. Unknown required checks prevent an unconditional ready statement.

Give concrete pre-deployment and post-deployment smoke steps plus rollback considerations when relevant. Separate code rollback from data restoration; irreversible migrations or external side effects may prevent a simple rollback. Do not claim the current deployment was tested from a local build alone.
