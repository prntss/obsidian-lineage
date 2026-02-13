import { describe, expect, it } from "vitest";
import { ProjectionEngine } from "../src/projection/projection-engine";
import { Session } from "../src/types";
import { createMockApp, getFileContent, readFrontmatter } from "./projection-test-utils";

function buildSession(): Session {
  return {
    metadata: {
      lineage_type: "research_session",
      title: "Person-only session",
      record_type: "other",
      repository: "Archive",
      locator: "Shelf A",
      projected_entities: []
    },
    session: {
      session: {
        id: "session-1",
        document: {
          transcription: "notes"
        }
      },
      sources: [],
      persons: [
        {
          id: "p1",
          name: "Jane Doe",
          matched_to: null
        }
      ],
      assertions: [],
      citations: []
    },
    freeformNotes: ""
  };
}

describe("projection: person-only sessions", () => {
  it("creates person entities when assertions are empty", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    const engine = new ProjectionEngine({
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never);

    const summary = await engine.projectSession(session);

    expect(summary.personsCreated).toBe(1);
    expect(summary.errors).toHaveLength(0);
    expect(session.session.persons[0].matched_to).toBe("[[Jane Doe]]");

    const content = getFileContent(files, "Lineage/People/Jane Doe.md");
    const frontmatter = readFrontmatter(content);
    expect(frontmatter.lineage_type).toBe("person");
    expect(frontmatter.name).toBe("Jane Doe");
  });

  it("is idempotent on reproject and preserves existing matched_to", async () => {
    const { app } = createMockApp();
    await app.vault.create(
      "Lineage/People/Jane Doe.md",
      `---
lineage_type: person
lineage_id: person-1
name: Jane Doe
---
`
    );
    const session = buildSession();
    session.session.persons[0].matched_to = "[[Jane Doe]]";
    const engine = new ProjectionEngine({
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never);

    const first = await engine.projectSession(session);
    const second = await engine.projectSession(session);

    expect(first.personsCreated).toBe(0);
    expect(first.personsUpdated).toBe(1);
    expect(second.personsCreated).toBe(0);
    expect(second.personsUpdated).toBe(1);
    expect(session.session.persons[0].matched_to).toBe("[[Jane Doe]]");
  });
});
