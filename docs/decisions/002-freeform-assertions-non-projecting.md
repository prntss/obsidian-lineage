---
date: 2026-02-12
status: accepted
---

# 002: Freeform assertions do not project to entities

## Context

Some evidence is ambiguous or exploratory and cannot be safely projected to structured entities without risking false precision.

## Decision

`freeform` assertions are retained in the session record only. They are visible for researcher context but are intentionally excluded from projection output.

## Alternatives Considered

- Project freeform text into generic entity structures: rejected because it introduces noisy or misleading records.

## Consequences

- Sessions preserve nuanced evidence without forcing structure too early.
- Projection remains deterministic and standards-aligned.
