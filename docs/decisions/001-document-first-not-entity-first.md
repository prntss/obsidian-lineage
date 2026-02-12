---
date: 2026-02-12
status: accepted
---

# 001: Document-first, not entity-first workflow

## Context

Genealogy workflows start from records and interpretation, but traditional systems force direct entity entry and break researcher context.

## Decision

Lineage uses research sessions as the primary workspace. Assertions are captured in session context first, then projected into entity notes.

## Alternatives Considered

- Entity-first editing as the primary flow: rejected because it increases context switching and weakens evidence capture.

## Consequences

- Session UX is mission-critical.
- Projection quality directly impacts trust in generated entities.
- Specs and features should be evaluated by how well they preserve research context.
