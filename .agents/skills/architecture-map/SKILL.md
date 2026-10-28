---
name: architecture-map
description: "Explain a repository's architecture, request flow, data lineage, or change impact using source-backed diagrams. Use on mapping requests, not routine edits."
---

# Architecture Map

Answer a specific architecture question using source evidence. User instructions and the actual code define the scope. Mapping a flow does not authorize refactoring it.

## Select and trace

Resolve the requested flow: a screen action, endpoint, background task, import, or whole-system overview. Inspect actual entry points, callers, dependencies, and configuration. Trace input validation, authorization where present, state changes, reads/writes, external calls, and failure or retry paths relevant to the question.

Distinguish observed execution from inferred static paths. Label conditional and asynchronous edges. State unresolved dynamic routing or unavailable services. Do not invent infrastructure from directory names, package dependencies, or an outdated design document.

For a whole-repository request, produce an overview first and show which areas were sampled. Expand when needed to answer the question; do not imply exhaustive tracing from a partial scan.

## Make the explanation inspectable

Choose the smallest useful format:

- Sequence diagram for ordered calls or asynchronous interaction.
- Flowchart for branches, retry loops, or state transitions.
- Component diagram for service ownership or boundaries.
- Table for field-to-field transformations or storage mappings.

Use Mermaid in Markdown by default. Use an HTML/SVG artifact when interaction or richer annotation is useful and supported. Keep generated artifacts self-contained when practical; do not upload source material to a third-party renderer. Check syntax with an available renderer, or disclose if rendering was not verified.

Give important nodes or edges identifiers and connect them to real file locations in an evidence table. Use repository-relative links in saved portable documents; use the host's clickable file convention in chat.

## Explain consequences

State the answer in plain language, then show the diagram and supporting code. For data-processing questions, describe origin, transformations, destination, side effects, and failure behaviour. For change-impact questions, identify affected callers, contracts, tables, and tests; distinguish confirmed dependencies from candidates.

Report missing evidence and the next read-only check that would resolve it. Do not claim runtime timing, scale, or deployed topology without measurements or environment evidence.
