import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import {
  buildCitationTemplate,
  buildEventTemplate,
  buildPersonTemplate,
  buildPlaceTemplate,
  buildRelationshipTemplate,
  buildSourceTemplate
} from "../src/templates/entity-templates";

function readFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error("Missing frontmatter");
  }
  return (yaml.load(match[1]) as Record<string, unknown>) ?? {};
}

describe("entity templates", () => {
  it("builds person template with required fields", () => {
    const template = buildPersonTemplate({ name: "Jane Doe", sex: "F" });
    const frontmatter = readFrontmatter(template);

    expect(frontmatter.lineage_type).toBe("person");
    expect(frontmatter.lineage_id).toBeDefined();
    expect(frontmatter.name).toBe("Jane Doe");
    expect(frontmatter.sex).toBe("F");
    expect(template).toContain("## Events");
    expect(template).toContain("## Relationships");
    expect(template).toContain("## Citations");
  });

  it("builds event template with participants", () => {
    const template = buildEventTemplate({
      event_type: "birth",
      date: "1900-01-01",
      place: "[[Cork, Ireland]]",
      participants: ["[[Jane Doe]]"]
    });
    const frontmatter = readFrontmatter(template);

    expect(frontmatter.lineage_type).toBe("event");
    expect(frontmatter.lineage_id).toBeDefined();
    expect(frontmatter.event_type).toBe("birth");
    expect(frontmatter.date).toBe("1900-01-01");
    expect(frontmatter.place).toBe("[[Cork, Ireland]]");
    expect(frontmatter.participants).toEqual(["[[Jane Doe]]"]);
    expect(template).toContain("## Participants");
    expect(template).toContain("## Citations");
  });

  it("builds place template with minimal headings", () => {
    const template = buildPlaceTemplate({ name: "Cork, Ireland" });
    const frontmatter = readFrontmatter(template);

    expect(frontmatter.lineage_type).toBe("place");
    expect(frontmatter.lineage_id).toBeDefined();
    expect(frontmatter.name).toBe("Cork, Ireland");
    expect(template).toContain("## Events");
  });

  it("builds relationship template with required fields", () => {
    const template = buildRelationshipTemplate({
      relationship_type: "spouse",
      person_a: "[[Jane Doe]]",
      person_b: "[[John Smith]]",
      date: "1888-05-04",
      place: "[[Dublin, Ireland]]"
    });
    const frontmatter = readFrontmatter(template);

    expect(frontmatter.lineage_type).toBe("relationship");
    expect(frontmatter.lineage_id).toBeDefined();
    expect(frontmatter.relationship_type).toBe("spouse");
    expect(frontmatter.person_a).toBe("[[Jane Doe]]");
    expect(frontmatter.person_b).toBe("[[John Smith]]");
    expect(frontmatter.date).toBe("1888-05-04");
    expect(frontmatter.place).toBe("[[Dublin, Ireland]]");
    expect(template).toContain("## Events");
    expect(template).toContain("## Citations");
  });

  it("builds source template with citation heading", () => {
    const template = buildSourceTemplate({
      title: "1900 Census",
      record_type: "census",
      repository: "National Archives",
      locator: "https://example.com",
      date: "1900-06-01"
    });
    const frontmatter = readFrontmatter(template);

    expect(frontmatter.lineage_type).toBe("source");
    expect(frontmatter.lineage_id).toBeDefined();
    expect(frontmatter.title).toBe("1900 Census");
    expect(frontmatter.record_type).toBe("census");
    expect(frontmatter.repository).toBe("National Archives");
    expect(frontmatter.locator).toBe("https://example.com");
    expect(frontmatter.date).toBe("1900-06-01");
    expect(template).toContain("## Citations");
  });

  it("builds citation template with snippet section", () => {
    const template = buildCitationTemplate({
      source_id: "s1",
      target_entity_id: "p1",
      target_entity_type: "person",
      assertion_id: "a1",
      snippet: "Sample text",
      locator: "Sheet 8A"
    });
    const frontmatter = readFrontmatter(template);

    expect(frontmatter.lineage_type).toBe("citation");
    expect(frontmatter.lineage_id).toBeDefined();
    expect(frontmatter.source_id).toBe("s1");
    expect(frontmatter.target_entity_id).toBe("p1");
    expect(frontmatter.target_entity_type).toBe("person");
    expect(frontmatter.assertion_id).toBe("a1");
    expect(frontmatter.snippet).toBe("Sample text");
    expect(frontmatter.locator).toBe("Sheet 8A");
    expect(template).toContain("## Snippet");
  });
});
