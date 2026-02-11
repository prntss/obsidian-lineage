import { describe, expect, it } from "vitest";
import {
  computeCompositeScore,
  rankCandidates,
  scoreDateOverlap,
  scoreName
} from "../src/duplicate-matcher";

describe("DuplicateMatcher scoring", () => {
  it("scores similar names highly", () => {
    const score = scoreName("John O'Connor", "John O'Conner");
    expect(score).toBeGreaterThan(0.8);
  });

  it("normalizes Mc/Mac variants", () => {
    const score = scoreName("MacDonald", "McDonald");
    expect(score).toBeGreaterThan(0.9);
  });

  it("scores unrelated names low", () => {
    const score = scoreName("John Smith", "Jane Doe");
    expect(score).toBeLessThan(0.4);
  });

  it("scores overlapping dates higher than non-overlapping", () => {
    const overlap = scoreDateOverlap("~1900", "1900-06-01");
    const noOverlap = scoreDateOverlap("1900-01-01", "1920-01-01");
    expect(overlap).toBeGreaterThan(noOverlap);
    expect(noOverlap).toBe(0);
  });

  it("returns neutral score when dates are missing", () => {
    expect(scoreDateOverlap(undefined, "1900-01-01")).toBe(0.5);
  });

  it("computes composite score with weights", () => {
    const score = computeCompositeScore({
      name: 1,
      date: 0.5,
      place: 0,
      relationship: 0
    });
    expect(score).toBeCloseTo(1 * 0.4 + 0.5 * 0.25, 5);
  });

  it("treats missing non-date features as zero, date as neutral", () => {
    const score = computeCompositeScore({
      date: 1
    });
    expect(score).toBeCloseTo(1 * 0.25, 5);
  });

  it("ranks candidates and filters by threshold", () => {
    const results = rankCandidates([
      { id: "a", features: { name: 1, date: 1, place: 1, relationship: 1 } },
      { id: "b", features: { name: 0.2, date: 0.2, place: 0.2, relationship: 0.2 } },
      { id: "c", features: { name: 0.9, date: 0.9, place: 0.1, relationship: 0.1 } }
    ]);

    expect(results.length).toBe(2);
    expect(results[0].id).toBe("a");
  });
});
