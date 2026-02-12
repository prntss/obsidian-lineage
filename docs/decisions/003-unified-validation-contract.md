---
date: 2026-02-12
status: accepted
---

# 003: Unified validation contract across save and submit

## Context

Validation had drift risk between autosave, manual save, and submit paths, creating inconsistent user experience and hard-to-debug behavior.

## Decision

Use one validation contract and shared result shape across save and submit flows. Different actions may enforce different severities, but they must consume the same validator output.

## Alternatives Considered

- Separate validators per action: rejected due to duplication and policy drift.

## Consequences

- Lower regression risk when validation rules evolve.
- Easier testing of validation outcomes and UI messaging.
