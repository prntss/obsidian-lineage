import { describe, expect, it } from "vitest";
import { ProjectionEngine } from "../src/projection/projection-engine";
import { Session } from "../src/types";
import { createMockApp } from "./projection-test-utils";

function buildSession(): Session {
  return {
    metadata: {
      lineage_type: "research_session",
      title: "Coverage Test",
      record_type: "other",
      repository: "Archive",
      locator: "Box 7",
      projected_entities: []
    },
    session: {
      session: {
        id: "session-1",
        document: { transcription: "example" }
      },
      sources: [],
      persons: [],
      assertions: [
        {
          id: "a1",
          type: "freeform",
          statement: "Unstructured note"
        }
      ],
      citations: []
    },
    freeformNotes: "## Notes"
  };
}

describe("projection: coverage notes", () => {
  it("surfaces non-projecting assertion types in summary notes", async () => {
    const { app } = createMockApp();
    const engine = new ProjectionEngine({
      app,
      settings: { baseFolder: "Lineage" },
      vaultIndexer: { findPlacesByName: () => [] }
    } as never);

    const summary = await engine.projectSession(buildSession());

    expect(summary.notes).toContain("1 freeform assertion not projected by design.");
  });
});
