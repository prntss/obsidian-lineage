import { describe, expect, it } from "vitest";
import { projectIdentityAssertions } from "../src/projection/rules/identity";
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

describe("projection: identity", () => {
  it("creates a person note from identity assertion", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    session.session.persons = [{ id: "p1" }];
    session.session.assertions = [
      {
        id: "a1",
        type: "identity",
        name: "Jane Doe",
        sex: "F",
        participants: [{ person_ref: "p1" }]
      }
    ];

    const summary = createEmptySummary();
    const state = createProjectionState();
    const context = {
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never;

    await projectIdentityAssertions(context, summary, state, session);

    expect(summary.personsCreated).toBe(1);
    expect(summary.errors).toHaveLength(0);

    const path = "Lineage/People/Jane Doe.md";
    const content = getFileContent(files, path);
    const frontmatter = readFrontmatter(content);
    expect(frontmatter.lineage_type).toBe("person");
    expect(frontmatter.name).toBe("Jane Doe");
    expect(frontmatter.sex).toBe("F");
  });
});
