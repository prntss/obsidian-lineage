import { describe, expect, it } from "vitest";
import { getUniquePath } from "../src/projection/utils";
import { createMockApp } from "./projection-test-utils";

describe("projection utils", () => {
  it("adds numeric suffix for duplicate paths", async () => {
    const { app } = createMockApp();
    await app.vault.create("Lineage/People/John Smith.md", "");

    const unique = getUniquePath(app, "Lineage/People/John Smith.md");
    expect(unique).toBe("Lineage/People/John Smith (2).md");
  });
});
