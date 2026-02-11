import { describe, expect, it } from "vitest";
import { projectParentChildAssertions } from "../src/projection/rules/parent-child";
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
      projected_entities: []
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

describe("projection: parent-child", () => {
  it("creates a parent-child relationship note", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    session.session.persons = [
      { id: "p1", name: "John O'Connor" },
      { id: "p2", name: "Mary O'Connor" }
    ];
    session.session.assertions = [
      {
        id: "a1",
        type: "parent-child",
        parent_ref: "p1",
        child_ref: "p2"
      }
    ];

    const summary = createEmptySummary();
    const state = createProjectionState();
    const context = {
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never;

    await projectParentChildAssertions(context, summary, state, session);

    expect(summary.relationshipsCreated).toBe(1);

    const path = "Lineage/Relationships/Child of John O'Connor - Mary O'Connor.md";
    const content = getFileContent(files, path);
    const frontmatter = readFrontmatter(content);
    expect(frontmatter.relationship_type).toBe("parent-child");
    expect(frontmatter.person_a).toBe("[[John O'Connor]]");
    expect(frontmatter.person_b).toBe("[[Mary O'Connor]]");
    expect(frontmatter.person_a_role).toBe("parent");
    expect(frontmatter.person_b_role).toBe("child");
  });
});
