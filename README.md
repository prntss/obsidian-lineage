# Lineage

Genealogy research that starts with evidence, not data entry.

Lineage gives you a focused workflow inside Obsidian:

- capture a source
- record what the source actually says
- project those findings into structured entity notes

If you are tired of bouncing between disconnected editors and forms, Lineage keeps your research context intact from first read to final notes.

## Why Lineage

Most genealogy tools are entity-first: create people and events first, then attach evidence later.

Lineage is session-first:

- start with the document
- capture claims in one place
- generate or update entities from evidence

This makes research faster to record, easier to review, and easier to trust.

## Key Features

- **Session-first workflow**: one workspace for source, people, assertions, and projection.
- **Evidence capture built in**: source metadata + URL/file/transcription support.
- **Structured assertions**: record key claim types without losing source context.
- **Safer matching**: assisted duplicate suggestions, never silent auto-merge.
- **Projection engine**: turn assertions into Person/Event/Place/Relationship/Source/Citation notes.
- **Markdown-native storage**: your research stays in plain files inside your vault.

## Installation

### BRAT (Recommended)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian Community Plugins.
2. Run **BRAT: Add a beta plugin for testing**.
3. Enter `prntss/lineage`.
4. Enable **Lineage** in Obsidian Community Plugins settings.

### Manual

1. Download the latest build from [Releases](https://github.com/prntss/lineage/releases).
2. Extract into `<vault>/.obsidian/plugins/lineage/`.
3. Reload Obsidian and enable **Lineage**.

### From Source

```bash
git clone https://github.com/prntss/lineage.git
cd lineage
npm install
npm run build
```

Then copy `main.js`, `styles.css`, and `manifest.json` into `<vault>/.obsidian/plugins/lineage/`.

## Quick Start

1. Open command palette (`Cmd+P` / `Ctrl+P`).
2. Run **Lineage: Create Research Session**.
3. Open the **Lineage Session Panel**.
4. Fill source metadata.
5. Add people and assertions.
6. Click **Project to Entities**.

## Current Status

Lineage is actively being developed but is usable for document-first research sessions. At this stage, it is not intended to manage full genealogy trees and does not support GEDCOM import or export.

### Shipped (0.1.0)

- Create and edit research sessions in a dedicated Session panel.
- Capture source details (title, record type, repository, locator, URL/file/transcription).
- Add people and get duplicate-match suggestions before creating new records.
- Record assertions and project them into entity notes (Person, Event, Place, Relationship, Source, Citation).
- Use improved session UI and validation feedback for daily research work.

### In Progress

- Make save/validation behavior more consistent and easier to trust.
- Improve assertion entry flows (especially participants and rematching).
- Tighten data quality rules for references, IDs, and projection behavior.

### Planned

- Expand the panel so it is useful in session, entity, and neutral note contexts.
- Improve matching reliability and make match links more stable over time.
- Improve compatibility and conflict visibility as data rules evolve.
- GEDCOM import and export.

## Documentation

### Technical Specs

- [Session Format](docs/specs/session-format.md)
- [Data Model](docs/specs/data-model.md)
- [UI Spec](docs/specs/ui-spec.md)
- [Assertion Model](docs/specs/assertion-model.md)
- [Projection Rules](docs/specs/projection-rules-current-spec.md)

## Contributing

Contributions are welcome.
You can create an issue to report a bug, suggest an improvement for this plugin, ask a question, etc.
You can make a pull request to contribute to this plugin development.

## License

MIT. See [LICENSE](LICENSE).
