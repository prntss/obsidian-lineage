import { describe, expect, it } from "vitest";
import { SessionManager } from "../src/session-manager";
import { buildSessionTemplate } from "../src/templates/session-template";

describe("buildSessionTemplate", () => {
  it("builds a parseable session with required defaults", () => {
    const manager = new SessionManager();
    const template = buildSessionTemplate("Template Test", { date: "2024-01-15" });
    const parsed = manager.parseSession(template);

    expect(parsed.metadata.lineage_type).toBe("research_session");
    expect(parsed.metadata.title).toBe("Template Test");
    expect(parsed.metadata.record_type).toBe("other");
    expect(parsed.metadata.repository).toBe("");
    expect(parsed.metadata.locator).toBe("");
    expect(parsed.metadata.session_date).toBe("2024-01-15");
  });

  it("includes the lineage-session code block", () => {
    const template = buildSessionTemplate("Template Test", { date: "2024-01-15" });
    expect(template).toContain("```lineage-session");
  });

  it("escapes quote and newline values so parsing succeeds", () => {
    const manager = new SessionManager();
    const title = "John \"Jack\" Smith\nResearch Notes";
    const template = buildSessionTemplate(title, {
      date: "2024-01-15",
      repository: "County \"Archive\"",
      locator: "Shelf A\nRow 2",
      documentUrl: "https://example.com/?q=\"smith\"",
      documentFile: "Sources/line\nbreak.txt",
      documentTranscription: "line 1\n\"quoted\" line 2"
    });

    const parsed = manager.parseSession(template);

    expect(parsed.metadata.title).toBe(title);
    expect(parsed.metadata.repository).toBe("County \"Archive\"");
    expect(parsed.metadata.locator).toBe("Shelf A\nRow 2");
    expect(parsed.session.session.document.url).toBe("https://example.com/?q=\"smith\"");
    expect(parsed.session.session.document.file).toBe("Sources/line\nbreak.txt");
    expect(parsed.session.session.document.transcription).toBe(
      "line 1\n\"quoted\" line 2"
    );
  });
});
