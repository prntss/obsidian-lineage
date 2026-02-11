import { describe, expect, it } from "vitest";
import { detectConflicts } from "../src/conflict-detector";

describe("ConflictDetector", () => {
  it("detects conflicts for the same person and type", () => {
    const conflicts = detectConflicts([
      {
        id: "a1",
        type: "birth",
        participants: [{ person_ref: "p1" }]
      },
      {
        id: "a2",
        type: "birth",
        participants: [{ person_ref: "p1" }]
      }
    ]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].severity).toBe("high");
    expect(conflicts[0].assertionIds).toEqual(["a1", "a2"]);
  });

  it("ignores assertions without participants", () => {
    const conflicts = detectConflicts([
      { id: "a1", type: "birth", participants: [] },
      { id: "a2", type: "birth" }
    ]);

    expect(conflicts).toHaveLength(0);
  });
});
