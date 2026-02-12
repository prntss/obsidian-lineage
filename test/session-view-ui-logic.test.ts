import { describe, expect, it } from "vitest";
import {
  ADD_ASSERTION_TYPES,
  getAssertionModalVisibility,
  getMatchActionLabel,
  getMatchStatusDisplay
} from "../src/views/session-view";

describe("session-view ui logic", () => {
  describe("getAssertionModalVisibility", () => {
    it("shows parent-child controls only for parent-child assertions", () => {
      for (const type of ADD_ASSERTION_TYPES) {
        const visibility = getAssertionModalVisibility(type);
        if (type === "parent-child") {
          expect(visibility.showParentChild).toBe(true);
          expect(visibility.showParticipants).toBe(false);
        } else {
          expect(visibility.showParentChild).toBe(false);
          expect(visibility.showParticipants).toBe(true);
        }
      }
    });

    it("shows identity-only fields only for identity assertions", () => {
      expect(getAssertionModalVisibility("identity").showIdentityFields).toBe(true);
      expect(getAssertionModalVisibility("birth").showIdentityFields).toBe(false);
      expect(getAssertionModalVisibility("freeform").showIdentityFields).toBe(false);
    });

    it("treats unknown assertion types as participant-based", () => {
      const visibility = getAssertionModalVisibility("baptism");
      expect(visibility.showParticipants).toBe(true);
      expect(visibility.showParentChild).toBe(false);
      expect(visibility.showIdentityFields).toBe(false);
    });
  });

  describe("matching label and status", () => {
    it("uses Match/⚠ unmatched for empty match state", () => {
      expect(getMatchActionLabel(null)).toBe("Match");
      expect(getMatchActionLabel(undefined)).toBe("Match");
      expect(getMatchActionLabel("")).toBe("Match");
      expect(getMatchActionLabel("   ")).toBe("Match");

      expect(getMatchStatusDisplay(null)).toEqual({ text: "⚠ unmatched" });
      expect(getMatchStatusDisplay("   ")).toEqual({ text: "⚠ unmatched" });
    });

    it("uses Rematch/✓ matched for present match state", () => {
      const matchedTo = "[[Jane Doe]]";
      expect(getMatchActionLabel(matchedTo)).toBe("Rematch");
      expect(getMatchStatusDisplay(matchedTo)).toEqual({
        text: "✓ matched",
        title: "Matched to [[Jane Doe]]"
      });
    });
  });
});

