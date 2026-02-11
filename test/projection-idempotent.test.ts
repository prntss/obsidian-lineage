import { describe, expect, it } from "vitest";
import { ensurePersonFile, buildProjectedEntityIndex } from "../src/projection/helpers";
import { createEmptySummary } from "../src/projection/types";
import { createMockApp, createProjectionState, getFileContent, readFrontmatter } from "./projection-test-utils";
import { Session } from "../src/types";

function buildSession(): Session {
  return {
    metadata: {
      lineage_type: "research_session",
      title: "",
      record_type: "other",
      repository: "",
      locator: "",
      projected_entities: ["[[Jane Doe]]"]
    },
    session: {
      session: { id: "s1", document: {} },
      sources: [],
      persons: [],
      assertions: [],
      citations: []
    },
    freeformNotes: ""
  };
}

describe("projection: idempotent person lookup", () => {
  it("reuses projected_entities for person matching", async () => {
    const { app, files } = createMockApp();
    const existingContent = `---
lineage_type: person
lineage_id: person-1
name: Jane Doe
---

## Events
`;
    await app.vault.create("Lineage/People/Jane Doe.md", existingContent);

    const session = buildSession();
    const summary = createEmptySummary();
    const state = createProjectionState();
    const context = {
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never;

    state.projectedEntities = buildProjectedEntityIndex(context, session);

    const file = await ensurePersonFile(context, state, summary, {
      id: "p1",
      name: "Jane Doe"
    });

    expect(file.path).toBe("Lineage/People/Jane Doe.md");
    expect(summary.personsCreated).toBe(0);
    expect(summary.personsUpdated).toBe(1);

    const content = getFileContent(files, "Lineage/People/Jane Doe.md");
    const frontmatter = readFrontmatter(content);
    expect(frontmatter.lineage_id).toBe("person-1");
  });
});
