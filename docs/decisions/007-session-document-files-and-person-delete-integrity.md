---
date: 2026-02-13
status: accepted
---

# 007: Canonical document.files model and blocked person delete on active assertion references

## Context

Two integrity-sensitive behaviors in session editing needed explicit policy alignment:

1. Session document linkage still used a single `document.file` value, which made multi-page source handling awkward and fragmented.
2. Person deletion silently removed assertion references, which could hide meaningful data mutations and undermine user trust.

At the same time, existing notes already in vaults may still contain legacy `document.file` values and must remain loadable.

## Decision

Adopt the following contracts:

- `session.document.files: string[]` is the canonical document file linkage model.
- Parser performs compatibility migration: when `document.files` is absent and legacy `document.file` is present, map it to `document.files`.
- Serializer and template output use `document.files` (not `document.file`) as the saved shape.
- Person deletion is blocked when any assertion references that person (participant, `parent_ref`, or `child_ref`).
- The UI must surface a clear blocking notice instead of auto-cleaning references.

This preserves user intent, prevents hidden mutation, and supports multi-file workflows without breaking legacy notes.

## Alternatives Considered

- Keep single-file model and require one session per source file: rejected due to workflow friction and context fragmentation.
- Support both `file` and `files` indefinitely as equal sources of truth: rejected due to ambiguity and long-term maintenance risk.
- Continue auto-cleaning assertion references during delete with warning: rejected because it still mutates linked assertions implicitly.

## Consequences

- Existing legacy notes continue to load through parse-time migration.
- Newly saved sessions converge on one canonical model (`document.files`).
- Users must resolve assertion references before deleting linked people, which adds small friction but improves integrity.
- Validation, UI field anchoring, and tests must account for indexed file keys (`document.files[n]`).
