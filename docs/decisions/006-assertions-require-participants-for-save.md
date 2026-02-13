---
date: 2026-02-13
status: accepted
---

# 006: Require participants for non-parent-child assertions at save time

## Context

SessionView previously allowed saving assertions with zero participants for non-`parent-child` types (for example `birth` with `participants: []`).

This created a trust gap:

- Users could see an inline warning (`This assertion has no participants...`) but still get `Saved ✓`.
- Projection and validation behavior diverged from user expectations of data completeness.
- Non-field validation summary improvements were less effective if semantically incomplete assertions still persisted.

## Decision

Treat empty-participant non-`parent-child` assertions as a blocking integrity error during save/project validation.

Policy:

- `parent-child` keeps its existing contract (`parent_ref` and `child_ref` are required).
- all other assertion types require at least one `participants[]` entry.
- validation issue shape: `kind: "integrity"`, `code: "ref_missing"`, with explicit participant-required message.

This aligns save semantics with reliability goals: structurally incomplete assertions should not silently persist as valid state.

## Alternatives Considered

- Keep warning-only behavior: rejected because it allows semantically incomplete assertions to persist while presenting successful save state.
- Auto-delete or auto-repair empty assertions: rejected because silent mutation is harder to reason about and can erase user intent.
- Exempt `freeform` from participant requirement now: deferred; possible future decision if team wants freeform as low-friction scratch capture.

## Consequences

- Stronger data integrity at save boundary for assertion records.
- Clearer user feedback: unresolved participant requirements now block save/project instead of silently succeeding.
- Potential workflow friction for users who relied on participant-less assertions as drafts.
- Follow-up consideration: decide explicitly whether `freeform` should remain under this rule or get a future carve-out.
