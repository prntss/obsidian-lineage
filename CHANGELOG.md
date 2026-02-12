# Changelog

All notable changes to the Lineage plugin.

## [Unreleased]

## Sprint 5 - 2026-02-11
### Added
- Projection engine rules for identity, birth/death, marriage, parent-child, and residence
- Citation creation linking assertions to projected entities
- Idempotent re-projection updates to existing entities
- Entity templates for Person, Event, Place, Relationship, Source, and Citation

## Sprint 4 - 2026-02-11
### Added
- Entity templates module
- Conflict detection logic

## Sprint 3 - 2026-02-11
### Added
- Person list UI with add/remove
- Match modal with duplicate scoring
- Assertion list UI with type-specific forms
- Place autocomplete

## Sprint 2 - 2026-02-11
### Added
- Editable source metadata fields (title, record type, repository, locator)
- Document capture UI (URL, file, transcription)
- Debounced autosave
- Date overlap and composite scoring for duplicate matching

## Sprint 1 - 2026-02-10
### Added
- Plugin scaffold (`manifest.json`, `main.ts`, `package.json`, `tsconfig.json`)
- Session note template with frontmatter and `lineage-session` block
- Session parser and serializer
- Create Research Session command
- Dockable Session panel (`SessionView`)
- Session loading from active file
