---
date: 2026-02-12
status: accepted
---

# 005: Create citation notes per target entity per assertion

## Context

Projection must preserve evidence lineage from a session assertion to each affected target entity.

## Decision

Generate citation artifacts at target-entity granularity so each projected entity has explicit evidence linkage for the assertion that affected it.

## Alternatives Considered

- One citation per session only: rejected because attribution becomes too coarse.
- One citation per assertion only without target linkage: rejected because downstream traceability is weaker.

## Consequences

- Better provenance and auditability.
- More citation artifacts, but with clearer evidence relationships.
