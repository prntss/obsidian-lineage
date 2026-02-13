import { describe, expect, it } from "vitest";
import { evaluateSessionValidation } from "../src/session-validation";
import { Session } from "../src/types";

function buildSession(overrides: Partial<Session> = {}): Session {
  const session: Session = {
    metadata: {
      lineage_type: "research_session",
      title: "Validation Test",
      record_type: "census",
      repository: "Archive",
      locator: "Box 3",
      session_date: "2024-01-15",
      projected_entities: []
    },
    session: {
      session: {
        id: "c6d79d2c-ecfc-49a7-9572-e0c1a4a7fbd0",
        document: {
          url: "https://example.com",
          file: "",
          transcription: ""
        }
      },
      sources: [],
      persons: [{ id: "p1", name: "John Doe" }],
      assertions: [
        {
          id: "a1",
          type: "birth",
          participants: [{ person_ref: "p1" }]
        }
      ],
      citations: []
    },
    freeformNotes: "## Notes"
  };

  return {
    ...session,
    ...overrides
  };
}

describe("evaluateSessionValidation", () => {
  it("treats bare-domain URLs as valid and non-blocking", () => {
    const session = buildSession();
    session.session.session.document.url = "google.com";

    const result = evaluateSessionValidation(session);

    expect(result.blocking).toBe(false);
    expect(result.issues.find((issue) => issue.code === "url_format_invalid")).toBeUndefined();
  });

  it("marks malformed URL as warning without blocking", () => {
    const session = buildSession();
    session.session.session.document.url = "http://::::";

    const result = evaluateSessionValidation(session);

    expect(result.blocking).toBe(false);
    expect(result.issues.some((issue) => issue.code === "url_format_invalid")).toBe(true);
    expect(result.issues.some((issue) => issue.level === "warning")).toBe(true);
  });

  it("blocks when assertion participant references missing person", () => {
    const session = buildSession();
    session.session.assertions[0].participants = [{ person_ref: "missing" }];

    const result = evaluateSessionValidation(session);

    expect(result.blocking).toBe(true);
    expect(result.issues.some((issue) => issue.code === "ref_invalid")).toBe(true);
  });

  it("blocks when assertion cites missing citation ID", () => {
    const session = buildSession();
    session.session.assertions[0].citations = ["c999"];

    const result = evaluateSessionValidation(session);

    expect(result.blocking).toBe(true);
    expect(result.issues.some((issue) => issue.code === "ref_invalid")).toBe(true);
  });

  it("blocks when non-parent-child assertion has no participants", () => {
    const session = buildSession();
    session.session.assertions[0].participants = [];

    const result = evaluateSessionValidation(session);

    expect(result.blocking).toBe(true);
    expect(
      result.issues.some(
        (issue) =>
          issue.code === "ref_missing" &&
          issue.text === "Assertion requires at least one participant."
      )
    ).toBe(true);
  });

  it("adds warning for fallback-format session IDs", () => {
    const session = buildSession();
    session.session.session.id = "fallback-id-123";

    const result = evaluateSessionValidation(session);

    expect(result.blocking).toBe(false);
    expect(result.issues.some((issue) => issue.code === "id_fallback")).toBe(true);
  });
});
