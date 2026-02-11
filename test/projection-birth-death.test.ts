import { describe, expect, it } from "vitest";
import { projectBirthDeathAssertions } from "../src/projection/rules/birth-death";
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

describe("projection: birth/death", () => {
  it("creates event, place, and person notes with principal ordering", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    session.session.persons = [
      { id: "p1", name: "Alice Smith" },
      { id: "p2", name: "Bob Smith" }
    ];
    session.session.assertions = [
      {
        id: "a1",
        type: "birth",
        date: "1900-01-01",
        place: "Cork, Ireland",
        participants: [
          { person_ref: "p1" },
          { person_ref: "p2", principal: true }
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

    await projectBirthDeathAssertions(context, summary, state, session);

    expect(summary.personsCreated).toBe(2);
    expect(summary.placesCreated).toBe(1);
    expect(summary.eventsCreated).toBe(1);

    const eventPath = "Lineage/Events/Birth - Bob Smith - 1900.md";
    const eventContent = getFileContent(files, eventPath);
    const eventFrontmatter = readFrontmatter(eventContent);
    expect(eventFrontmatter.event_type).toBe("birth");
    expect(eventFrontmatter.place).toBe("[[Cork, Ireland]]");
    expect(eventFrontmatter.participants).toEqual(["[[Bob Smith]]", "[[Alice Smith]]"]);

    const placePath = "Lineage/Places/Cork, Ireland.md";
    const placeContent = getFileContent(files, placePath);
    const placeFrontmatter = readFrontmatter(placeContent);
    expect(placeFrontmatter.lineage_type).toBe("place");
    expect(placeFrontmatter.name).toBe("Cork, Ireland");
  });
});
