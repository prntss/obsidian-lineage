import { describe, expect, it } from "vitest";
import { projectResidenceAssertions } from "../src/projection/rules/residence";
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

describe("projection: residence", () => {
  it("creates a residence event with place and participants", async () => {
    const { app, files } = createMockApp();
    const session = buildSession();
    session.session.persons = [
      { id: "p1", name: "Alice Smith" },
      { id: "p2", name: "Bob Smith" }
    ];
    session.session.assertions = [
      {
        id: "a1",
        type: "residence",
        date: "1901-03-31",
        place: "15 Main Street, Cork",
        participants: [{ person_ref: "p1" }, { person_ref: "p2" }]
      }
    ];

    const summary = createEmptySummary();
    const state = createProjectionState();
    const context = {
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never;

    await projectResidenceAssertions(context, summary, state, session);

    expect(summary.eventsCreated).toBe(1);
    expect(summary.placesCreated).toBe(1);

    const eventPath = "Lineage/Events/Residence - Alice Smith - 1901.md";
    const eventContent = getFileContent(files, eventPath);
    const eventFrontmatter = readFrontmatter(eventContent);
    expect(eventFrontmatter.event_type).toBe("residence");
    expect(eventFrontmatter.place).toBe("[[15 Main Street, Cork]]");
    expect(eventFrontmatter.participants).toEqual(["[[Alice Smith]]", "[[Bob Smith]]"]);
  });

  it("logs an error when place is missing", async () => {
    const { app } = createMockApp();
    const session = buildSession();
    session.session.persons = [{ id: "p1", name: "Alice Smith" }];
    session.session.assertions = [
      {
        id: "a1",
        type: "residence",
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

    await projectResidenceAssertions(context, summary, state, session);

    expect(summary.errors).toContain("Residence assertion a1 requires a place.");
  });
});
