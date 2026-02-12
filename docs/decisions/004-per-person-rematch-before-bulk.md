---
date: 2026-02-12
status: accepted
---

# 004: Ship per-person rematch before bulk rematch

## Context

Rematching is often a surgical correction for one person row. Bulk rematch introduces policy complexity around confirmed matches, overrides, and undo behavior.

## Decision

Implement row-level per-person rematch first. Defer bulk rematch to a later wave after usage data and policy decisions are available.

## Alternatives Considered

- Bulk rematch first: rejected because it is higher risk and lower precision for the common case.
- Ship both together: rejected to keep Wave 2 scope focused and shippable.

## Consequences

- Researchers get immediate targeted correction workflows.
- Bulk behavior can be designed with real usage feedback.
