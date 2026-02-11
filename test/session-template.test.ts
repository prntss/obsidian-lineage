import { describe, expect, it } from "vitest";
import { buildSessionTemplate } from "../src/templates/session-template";


describe("buildSessionTemplate", () => {
  it("includes required frontmatter fields", () => {
    const template = buildSessionTemplate("Template Test", { date: "2024-01-15" });

    expect(template).toContain("lineage_type: research_session");
    expect(template).toContain("title: \"Template Test\"");
    expect(template).toContain("record_type: other");
    expect(template).toContain("repository: \"\"");
    expect(template).toContain("locator: \"\"");
    expect(template).toContain("session_date: 2024-01-15");
  });

  it("includes the lineage-session code block", () => {
    const template = buildSessionTemplate("Template Test", { date: "2024-01-15" });
    expect(template).toContain("```lineage-session");
  });
});
