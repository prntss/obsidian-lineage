# Lineage

A research-centric genealogy workflow for Obsidian that puts documents before databases.

## The Problem

**Every major genealogy tool** (Gramps, Ancestry, FamilySearch, RootsMagic, Family Tree Maker) forces you to think in entities: create a Person, add an Event, link a Source. But that's not how research works.

When you analyze a census record, you don't encounter isolated "Person records"—you encounter a **document** containing statements about multiple people. Recording what you find requires jumping between disconnected editors, losing context with each click.

**What feels like one action** ("record what this census says about John") **becomes six separate operations** spread across multiple screens. Your mental model and the software's model don't match.

This entity-first approach has dominated for 30+ years. The GEDCOM standard, family tree visualizations, and hobbyist focus have locked the industry into database-centric design.

## The Solution

**Research sessions are your workspace.** One session, one document, many findings.

Inside a session, you:
1. **Capture** the document (URL, file, or transcription)
2. **Identify** people mentioned
3. **Record assertions** about what the document states
4. **Project** those assertions to create or update Person, Event, and Place notes

Entities become *outcomes* of your research, not prerequisites for data entry.

## Key Features

- **Document-first workflow** — Start with the source, not the database
- **Snippet-level citations** — Quote exactly what the record says
- **Assisted matching** — Suggest duplicates, never auto-merge
- **Conflict preservation** — Multiple birth dates? Keep both, mark conflicts
- **Markdown storage** — All data stored as human-readable notes
- **GEDCOM-compatible** — Entity model aligns with genealogy standards

## Quick Start

**Prerequisites:**
- Obsidian 1.4+
- Lineage plugin installed (see [Installation](#installation))

**Create your first research session:**

1. Open command palette (`Cmd+P` / `Ctrl+P`)
2. Run **"Lineage: Create Research Session"**
3. A new session note opens with this structure:

```markdown
---
lineage_type: research_session
title: "Research Session"
record_type: census
repository: ""
locator: ""
session_date: 2024-01-15
---

# Research Session

## Notes

[Your research notes here...]

```lineage-session
session:
  id: 550e8400-e29b-41d4-a716-446655440000
  document:
    url: ""
    file: ""
    transcription: ""
```
```

4. Open the **Lineage Session Panel** (right sidebar)
5. Fill in source metadata and start recording assertions

## Example Workflow

Let's analyze a 1901 Irish census record for the O'Connor family.

### Step 1: Capture the Document

Fill in the session metadata:
- **Title:** "1901 Census - O'Connor Family"
- **Record Type:** Census
- **Repository:** "National Archives of Ireland"
- **URL:** `https://www.ancestry.com/imageviewer/12345`

### Step 2: Add People

Add two people from the census:
- **John O'Connor** (Male)
- **Mary O'Connor** (Female)

The plugin scans your vault and suggests: "Did you mean [[John O'Connor (b. 1872)]]?"

You confirm the match or create a new person.

### Step 3: Record Assertions

Add assertions about what the document states:

**Assertion 1: Birth (John)**
- **Type:** Birth
- **Person:** John O'Connor
- **Date:** ~1872 (calculated from age 29 in 1901)
- **Place:** Cork, Ireland
- **Statement:** "Age 29 in 1901, born Cork"
- **Citation:** "Page 3, Line 12: John O'Connor, Head, M, 29..."

**Assertion 2: Residence (John & Mary)**
- **Type:** Residence
- **Participants:** John O'Connor, Mary O'Connor
- **Date:** 1901-03-31
- **Place:** 15 Main Street, Cork
- **Statement:** "Residing at 15 Main Street"
- **Citation:** "Page 3, Lines 12-13"

**Assertion 3: Marriage (John & Mary)**
- **Type:** Marriage
- **Participants:** John O'Connor, Mary O'Connor
- **Statement:** "Both listed as married"
- **Citation:** "Page 3, Lines 12-13"

### Step 4: Project to Entities

Click **"Project to Entities"** in the session panel.

The plugin creates or updates:
- `John O'Connor.md` (Person note)
- `1901 Ireland Census - O'Connor.md` (Source note)
- `Birth - John O'Connor ~1872.md` (Event note)
- `Residence - 15 Main St Cork 1901.md` (Event note)
- `Marriage - John & Mary O'Connor.md` (Relationship note)
- Citation notes linking assertions to entities

**Result:** Your session note remains the authoritative record. Entity notes are generated views of your research.

## Installation

### For Users

**Not yet available in Community Plugins.**

Manual installation:
1. Download the latest release from [Releases](https://github.com/prentissw/lineage/releases)
2. Extract to `.obsidian/plugins/lineage/`
3. Reload Obsidian
4. Enable "Lineage" in Settings → Community Plugins

### For Developers

Clone and build from source:

```bash
# Clone repository
git clone https://github.com/prentissw/lineage.git
cd lineage

# Install dependencies
npm install

# Build plugin
npm run build

# Or run in development mode (auto-rebuild on changes)
npm run dev
```

Link to your vault for testing:

```bash
# Link plugin to your vault
ln -s /path/to/lineage /path/to/your-vault/.obsidian/plugins/lineage

# Reload Obsidian to activate
```

## Project Status

**Current Milestone:** Sprint 2 — Document Capture & Metadata UI

**Completed:**
- ✅ Sprint 1: Session parsing and dockable panel
- ✅ Basic session note templates
- ✅ Session panel displays metadata

**In Progress:**
- 🚧 Editable source metadata fields
- 🚧 Document capture UI (URL/file/transcription modes)
- 🚧 Duplicate matching score calculation

**Upcoming:**
- Person management with assisted matching
- Assertion entry forms
- Projection engine
- Conflict marking

See [Milestones](docs/milestones.md) for the full roadmap.

## How It Works

Lineage uses a **two-tier data model**:

### Tier 1: Research Sessions (Primary)
- Markdown notes with YAML frontmatter
- Structured `lineage-session` code blocks
- Contains: persons, assertions, citations
- **Portable** — Copy between vaults, version control, human-readable

### Tier 2: Entity Notes (Projected)
- Person, Event, Place, Relationship, Source notes
- Generated from session assertions
- **GEDCOM-compatible** — Standard genealogy entity model
- Updated when sessions are re-projected

**Key insight:** Research sessions are source of truth. Entity notes are views.

## Development Setup

### Prerequisites
- Node.js 18+
- npm 8+
- Obsidian 1.4+

### Build Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Build and watch for changes |
| `npm run build` | Production build |
| `npm test` | Run unit tests (Vitest) |

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

### Project Structure

```
lineage/
├── src/
│   ├── main.ts              # Plugin entry point
│   ├── session-manager.ts   # Parse/serialize sessions
│   ├── views/
│   │   └── session-view.ts  # Dockable panel
│   ├── types.ts             # TypeScript definitions
│   └── commands.ts          # Command palette actions
├── styles.css               # Canonical plugin + panel styles
├── test/                    # Vitest unit tests
├── docs/                    # Specification documents
│   ├── overview.md          # Design principles
│   ├── spec/                # Current-state flow specs
│   │   ├── data-model.md    # Data model behavior (as implemented)
│   │   ├── session-format.md # Session format behavior (as implemented)
│   │   └── ui-spec.md       # Session UI behavior (as implemented)
│   └── milestones.md        # Implementation roadmap
├── manifest.json            # Obsidian plugin manifest
├── package.json
└── tsconfig.json
```

## Documentation

**For Users:**
- [Overview](docs/overview.md) — Problem statement and design principles
- [Session Format](docs/spec/session-format.md) — How session notes are parsed and persisted
- [Data Model](docs/spec/data-model.md) — Understanding entities

**For Developers:**
- [Milestones](docs/milestones.md) — Implementation roadmap with acceptance criteria
- [UI Spec](docs/spec/ui-spec.md) — Session panel behavior and UX flow
- [Assertion Model](docs/specs/assertion-model.md) — As-implemented assertion behavior and flow analysis
- [Projection Rules](docs/projection-rules.md) — How assertions become entities

**Reference:**
- [Genealogy Standards (BCG)](docs/reference/genealogy-standards.md) — BCG Genealogical Standards (2nd ed.)

## Why Lineage?

**Problem:** Traditional tools model genealogy as a database problem.

**Lineage models it as a research problem.**

Research happens in sessions. A session analyzes one source, interprets multiple statements, and produces assertions about people, events, and relationships. Those assertions *become* the entities in your family tree.

This matches how genealogists actually work: document → interpretation → conclusions.

### How Lineage Differs

| Traditional Tools | Lineage |
|-------------------|---------|
| **Start with entities** — Create Person first | **Start with documents** — Capture source first |
| **Sources attached later** — Add evidence to conclusions | **Assertions generate conclusions** — Evidence produces entities |
| **Single fact per person** — Pick "correct" birth date | **Conflicts preserved** — Keep multiple birth dates, mark conflict |
| **Entity-first editing** — Jump between Person/Event editors | **Session-first editing** — All findings in one workspace |
| **Database files** — GEDCOM, SQLite, proprietary formats | **Markdown notes** — Human-readable, git-friendly, portable |

### What Professional Genealogists Do Today

Since no genealogy software supports research-first workflows, professionals have developed workarounds:

**Parallel note-taking systems:**
- Research in Word, Google Docs, or Evernote
- Manually transfer conclusions to Gramps or Ancestry
- Context lost between research notes and database

**Separate research logs:**
- Tools like Gramps have "Research Log" features
- But logs are disconnected from actual data entry
- Still requires entity-first input

**Manual Obsidian notes:**
- Some genealogists discovered Obsidian on their own
- Create custom note systems without structure
- No projection to entities, no assertion model
- Reinventing the workflow from scratch

**Evidence analysis documents:**
- Following BCG (Board for Certification of Genealogists) standards manually
- Write evidence analysis separately
- Then transfer to genealogy software
- Research stays separate from the tree

Lineage eliminates these workarounds by making the research session the primary workspace.

### Why Research-First Architecture Hasn't Existed

**GEDCOM standard:**
- Defines entity-first data model (Person, Event, Source)
- All tools built around this 30-year-old format
- Hard to retrofit research-first workflow

**Visual family trees:**
- Marketing focuses on "See your family tree!"
- Requires Person entities to exist first
- Research-first is harder to visualize

**Hobbyist focus:**
- Most users are casual family historians
- Enter stories from relatives, no sources
- Professional research methods are niche

**No platform fit:**
- Desktop genealogy apps too heavy
- Web apps require server infrastructure
- Obsidian's markdown + plugin model enables this architecture

## Who Is This For?

Lineage is designed for researchers who prioritize evidence over visual family trees.

### ✅ You'll Love Lineage If You:

**Professional genealogists:**
- Follow BCG (Board for Certification of Genealogists) standards
- Need rigorous source analysis and citation
- Want research sessions to match your workflow
- Deliver evidence-based reports to clients

**Serious hobbyists:**
- Frustrated with entity-first tools losing context
- Want snippet-level citations, not just source links
- Prefer markdown and plain text workflows
- Use Obsidian for other research or PKM

**Academic researchers:**
- Historians or biographers needing genealogy features
- Require transparent evidence chains
- Don't need flashy family tree visualizations
- Value portable, text-based data

### ❌ Lineage Might Not Be For You If You:

**Casual family tree builders:**
- Want quick visual family trees
- Primarily enter family stories without sources
- Prefer web-based or mobile apps
- **Try instead:** Ancestry.com, FamilySearch, MyHeritage

**GEDCOM import users:**
- Need to import existing GEDCOM files (not yet supported)
- Primarily work in other genealogy software
- **Wait for:** GEDCOM import (post-MVP feature)

**Non-Obsidian users:**
- Don't use or want to learn Obsidian
- Prefer standalone desktop apps
- **Try instead:** Gramps (open-source, entity-first)

### The Target: Research-Minded Genealogists

If you've ever thought "I wish I could just record what this document says without creating a Person first," Lineage is for you.

If you're already taking genealogy notes in Obsidian and wishing they were more structured, Lineage is for you.

If you follow professional research standards but current software doesn't match your workflow, Lineage is for you.

## Troubleshooting

### Session panel not showing
**Cause:** Session note missing required frontmatter or `lineage-session` block

**Solution:** Ensure your note includes:
```markdown
---
lineage_type: research_session
title: "Your Title"
---

```lineage-session
session:
  id: [generate UUID]
```
```

### "Malformed session" error
**Cause:** Invalid YAML in `lineage-session` block

**Solution:** Validate YAML syntax. Check for:
- Correct indentation (2 spaces)
- Quoted strings with special characters
- Valid date formats (ISO 8601)

### Plugin not loading
**Cause:** Build files missing or outdated

**Solution:**
```bash
npm run build
# Reload Obsidian (Cmd+R / Ctrl+R)
```

## Contributing

Contributions welcome! This project is in early development.

**Ways to contribute:**
- Report bugs via [Issues](https://github.com/prentissw/lineage/issues)
- Suggest features (especially from practicing genealogists)
- Submit pull requests (see [Development Setup](#development-setup))
- Improve documentation

**Before contributing:**
1. Read [Overview](docs/overview.md) to understand design principles
2. Check [Milestones](docs/milestones.md) for current priorities
3. Open an issue to discuss major changes

## License

0-BSD License — see [LICENSE](LICENSE) for details.

---

**Built for genealogists who think in documents, not databases.**
