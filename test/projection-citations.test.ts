import { describe, expect, it } from "vitest";
import { projectCitations } from "../src/projection/rules/citations";
import { projectIdentityAssertions } from "../src/projection/rules/identity";
import { createEmptySummary } from "../src/projection/types";
import { createMockApp, createProjectionState, getFileContent, readFrontmatter } from "./projection-test-utils";
import { Session } from "../src/types";

function buildSession(): Session {
  return {
    metadata: {
      lineage_type: "research_session",
      title: "1900 Census - Smith Household",
      record_type: "census",
      repository: "National Archives",
      locator: "https://example.com",
      projected_entities: []
    },
    session: {
      session: { id: "s1", document: { url: "https://example.com" } },
      sources: [],
      persons: [],
      assertions: [],
      citations: []
    },
    freeformNotes: ""
  };
}

describe("projection: citations", () => {
  it("creates source and citation notes for assertion targets", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    session.session.persons = [{ id: "p1", name: "Jane Doe" }];
    session.session.assertions = [
      {
        id: "a1",
        type: "identity",
        name: "Jane Doe",
        participants: [{ person_ref: "p1" }],
        citations: ["c1"]
      }
    ];
    session.session.citations = [
      {
        id: "c1",
        source_id: "s1",
        snippet: "Jane Doe, age 22",
        locator: "Page 1"
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
    await projectCitations(context, summary, state, session);

    const sourcePath = "Lineage/Sources/1900 Census - Smith Household.md";
    const sourceContent = getFileContent(files, sourcePath);
    const sourceFrontmatter = readFrontmatter(sourceContent);
    expect(sourceFrontmatter.lineage_type).toBe("source");
    expect(sourceFrontmatter.title).toBe("1900 Census - Smith Household");

    const citationPath =
      "Lineage/Citations/Citation - 1900 Census - Smith Household - Jane Doe (a1).md";
    const citationContent = getFileContent(files, citationPath);
    const citationFrontmatter = readFrontmatter(citationContent);
    expect(citationFrontmatter.lineage_type).toBe("citation");
    expect(citationFrontmatter.target_entity_type).toBe("person");
    expect(citationFrontmatter.assertion_id).toBe("a1");
    expect(citationFrontmatter.snippet).toBe("Jane Doe, age 22");
    expect(citationFrontmatter.locator).toBe("Page 1");
  });
});
