---
name: browser-diagnostics
description: "Reproduce web UI bugs and inspect browser console, network, rendering, or performance evidence using available browser tools."
---

# Browser Diagnostics

Inspect the requested web behaviour in a development or user-authorized test environment. This skill supplies a workflow; it does not install or provide a browser tool.

## Establish capabilities and target

Discover available browser/DevTools tools and existing browser-test scripts. Use the connected browser tool or the repository's configured automation. Do not invent tool names or assume Chrome DevTools MCP is installed.

Confirm the target URL from project configuration or the user. Inspect a start script before launching it. Prefer a separate development browser context with test data. Record relevant browser, route, viewport, and authentication setup without copying session tokens.

If browser control is unavailable, inspect relevant source and existing tests, provide a concrete reproduction/checklist, and clearly mark live UI verification as not performed. Never treat static reasoning or a mock response as a browser run.

## Reproduce and diagnose

Exercise the smallest interaction sequence that shows the problem. Capture expected and actual state, relevant console errors and failed requests, response status, and a screenshot when useful. Redact sensitive fields from saved evidence. Wait for explicit UI or network state rather than arbitrary delays.

Follow the failing request or event into source code and server behaviour when accessible. A failed request may originate in the client, proxy, server, or external dependency; inspect evidence before assigning the cause. Browser success does not prove server authorization or database correctness.

For performance questions, record a trace or use existing measurements. State cache condition, environment, workload, and baseline. Do not infer a speedup from a smaller bundle or subjective responsiveness alone.

## Fix and verify within the request

For diagnosis-only requests, report evidence and fix direction. For requested fixes, implement the responsible change, rerun the original interaction, and add a stable regression test through the existing framework when valuable. Include relevant empty/error states and keyboard interaction where affected.

Do not change application records, replay payments, send messages, or use a personal browser profile as a side effect of testing without relevant authorization. A browser connection can expose real data and perform real actions.

## Handoff

Report reproduction steps, supported cause, changes if made, browser results, and remaining gaps. Distinguish browser checks from backend checks and performance measurements.
