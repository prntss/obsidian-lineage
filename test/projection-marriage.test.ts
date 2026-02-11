import { describe, expect, it } from "vitest";
import { projectMarriageAssertions } from "../src/projection/rules/marriage";
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

describe("projection: marriage", () => {
  it("creates relationship and marriage event notes", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    session.session.persons = [
      { id: "p1", name: "Jane Doe" },
      { id: "p2", name: "John Smith" }
    ];
    session.session.assertions = [
      {
        id: "a1",
        type: "marriage",
        date: "1888-05-04",
        place: "Dublin, Ireland",
        participants: [
          { person_ref: "p1" },
          { person_ref: "p2" }
        ]
      }
    ];

    const summary = createEmptySummary();
    const state = createProjectionState();
    const context = {
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never;

    await projectMarriageAssertions(context, summary, state, session);

    expect(summary.relationshipsCreated).toBe(1);
    expect(summary.eventsCreated).toBe(1);
    expect(summary.placesCreated).toBe(1);

    const relationshipPath = "Lineage/Relationships/Relationship - Jane Doe & John Smith.md";
    const relationshipContent = getFileContent(files, relationshipPath);
    const relationshipFrontmatter = readFrontmatter(relationshipContent);
    expect(relationshipFrontmatter.relationship_type).toBe("spouse");
    expect(relationshipFrontmatter.person_a).toBe("[[Jane Doe]]");
    expect(relationshipFrontmatter.person_b).toBe("[[John Smith]]");

    const eventPath = "Lineage/Events/Marriage - Jane Doe - 1888.md";
    const eventContent = getFileContent(files, eventPath);
    const eventFrontmatter = readFrontmatter(eventContent);
    expect(eventFrontmatter.event_type).toBe("marriage");
    expect(eventFrontmatter.place).toBe("[[Dublin, Ireland]]");
    expect(eventFrontmatter.participants).toEqual(["[[Jane Doe]]", "[[John Smith]]"]);
  });
});
