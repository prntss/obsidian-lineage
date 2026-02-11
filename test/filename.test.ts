import { describe, expect, it } from "vitest";
import {
  citationFilename,
  eventFilename,
  extractYear,
  parentChildFilename,
  personFilename,
  relationshipFilename,
  sanitizeFilename,
  sourceFilename
} from "../src/utils/filename";

describe("filename helpers", () => {
  it("sanitizes invalid characters and trailing dots/spaces", () => {
    expect(sanitizeFilename(" John: Doe? ")).toBe("John Doe");
    expect(sanitizeFilename("Report. ")).toBe("Report");
  });

  it("collapses whitespace and enforces max length", () => {
    expect(sanitizeFilename("John   Doe")).toBe("John Doe");

    const long = "a".repeat(200);
    const result = sanitizeFilename(long);
    expect(result.length).toBeLessThanOrEqual(120);
  });

  it("extracts a year from date strings", () => {
    expect(extractYear("1900-01-01")).toBe("1900");
    expect(extractYear("About 1888")).toBe("1888");
    expect(extractYear(undefined)).toBeNull();
  });

  it("builds entity filenames", () => {
    expect(personFilename("Jane Doe")).toBe("Jane Doe");
    expect(eventFilename("birth", "Jane Doe", "1900")).toBe("Birth - Jane Doe - 1900");
    expect(relationshipFilename("Jane Doe", "John Smith")).toBe("Relationship - Jane Doe & John Smith");
    expect(parentChildFilename("Jane Doe", "John Smith")).toBe("Child of Jane Doe - John Smith");
    expect(sourceFilename("census", "Jane Doe", "1900")).toBe("Census - Jane Doe - 1900");
    expect(sourceFilename("census")).toBe("Census - Untitled");
    expect(citationFilename("1900 Census", "Jane Doe", "a1")).toBe(
      "Citation - 1900 Census - Jane Doe (a1)"
    );
  });
});
