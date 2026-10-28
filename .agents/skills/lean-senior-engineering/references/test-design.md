# Choose tests that detect failures

Identify the observable contract first: input, output, state change, or externally visible side effect. Prefer the nearest existing test framework and fixtures. Do not introduce a framework just for this pack.

For a reproducible bug, reuse a test that already captures the faulty behaviour. Add a case only when useful coverage is missing. Run the relevant case to confirm the failure, implement the fix, and rerun it. A test that fails because of a bad import or missing service does not establish the regression. Capture baseline evidence before editing when possible. Never roll back or discard user changes to demonstrate a red phase.

For new logic, implement in small tested slices. Select cases by risk: normal input, the boundary that changes a branch, rejected input, and an important failure or retry path. Avoid mechanically adding every possible combination.

Assert behaviour through a stable interface rather than private helper names or exact call order. A parser test should assert parsed values and invalid-input handling; it should not merely assert that a helper was called. For a database constraint or transaction bug, an integration test may be necessary: mocks cannot prove the database semantics.

Mock external services at actual boundaries when a real call would be unavailable, costly, or cause side effects. Exercise the application logic. State which integration behaviour the mock leaves unverified.

For asynchronous UI behaviour, wait for the relevant state or event instead of arbitrary sleeps. For nondeterministic cases, control the clock, seed, or concurrency boundary where practical. Do not keep rerunning a flaky check until one pass hides the failure.

For performance work, measure the same workload before and after, with stated data size and environment. Test counts, line counts, and guesses are not performance measurements.

Do not weaken assertions, swallow exceptions, skip a failing test, or update a snapshot simply to obtain a pass. Update expectations when the user's changed requirement justifies the new behaviour and explain why.
