import { describe, expect, it } from "vitest";
import { SessionManager } from "../src/session-manager";
import { Session } from "../src/types";

const manager = new SessionManager();

const validContent = `---
lineage_type: research_session
title: "Test Session"
record_type: census
repository: "Test Archive"
locator: "https://example.com"
session_date: 2024-01-15
projected_entities: []
---

## Notes
User notes here

\`\`\`lineage-session
session:
  id: test-id
  document:
    url: "https://example.com"
    files: []
    transcription: ""
sources: []
persons: []
assertions: []
citations: []
\`\`\`
`;

describe("SessionManager.parseSession", () => {
  it("parses a valid session note", () => {
    const session = manager.parseSession(validContent);
    expect(session.metadata.title).toBe("Test Session");
    expect(session.freeformNotes).toContain("User notes here");
  });

  it("parses parent-child assertion fields", () => {
    const content = `---
lineage_type: research_session
title: "Test Session"
record_type: census
repository: "Test Archive"
locator: "https://example.com"
projected_entities: []
---

\`\`\`lineage-session
session:
  id: test-id
  document:
    url: "https://example.com"
    files: []
    transcription: ""
sources: []
persons:
  - id: p1
    name: "Parent"
  - id: p2
    name: "Child"
assertions:
  - id: a1
    type: parent-child
    parent_ref: p1
    child_ref: p2
citations: []
\`\`\`
`;

    const session = manager.parseSession(content);
    expect(session.session.assertions[0].parent_ref).toBe("p1");
    expect(session.session.assertions[0].child_ref).toBe("p2");
  });

  it("handles malformed YAML frontmatter", () => {
    const content = `---
lineage_type: research_session
  bad_indent: value
---

\`\`\`lineage-session
session:
  id: test-id
  document:
    url: "https://example.com"
    files: []
    transcription: ""
sources: []
persons: []
assertions: []
citations: []
\`\`\`
`;

    expect(() => manager.parseSession(content)).toThrow(/YAML parsing failed/);
  });

  it("rejects invalid types in frontmatter", () => {
    const content = `---
lineage_type: research_session
title: 123
record_type: census
repository: "Repo"
locator: "Location"
projected_entities: []
---

\`\`\`lineage-session
session:
  id: test-id
  document:
    url: "https://example.com"
    files: []
    transcription: ""
sources: []
persons: []
assertions: []
citations: []
\`\`\`
`;

    expect(() => manager.parseSession(content)).toThrow(/Expected title to be a string/);
  });

  it("migrates legacy document.file into document.files", () => {
    const content = `---
lineage_type: research_session
title: "Legacy File Session"
record_type: census
repository: "Test Archive"
locator: "https://example.com"
projected_entities: []
---

\`\`\`lineage-session
session:
  id: test-id
  document:
    url: "https://example.com"
    file: "Sources/legacy.png"
    transcription: ""
sources: []
persons: []
assertions: []
citations: []
\`\`\`
`;

    const session = manager.parseSession(content);
    expect(session.session.session.document.files).toEqual(["Sources/legacy.png"]);
  });

  it("prefers document.files when both files and legacy file exist", () => {
    const content = `---
lineage_type: research_session
title: "Dual File Session"
record_type: census
repository: "Test Archive"
locator: "https://example.com"
projected_entities: []
---

\`\`\`lineage-session
session:
  id: test-id
  document:
    url: "https://example.com"
    files:
      - "Sources/new-a.png"
      - "Sources/new-b.png"
    file: "Sources/legacy.png"
    transcription: ""
sources: []
persons: []
assertions: []
citations: []
\`\`\`
`;

    const session = manager.parseSession(content);
    expect(session.session.session.document.files).toEqual([
      "Sources/new-a.png",
      "Sources/new-b.png"
    ]);
  });
});

describe("SessionManager.serializeSession", () => {
  it("round-trips parse -> serialize -> parse", () => {
    const session: Session = {
      metadata: {
        lineage_type: "research_session",
        title: "Round Trip",
        record_type: "census",
        repository: "Archive",
        locator: "https://example.com",
        session_date: "2024-01-15",
        projected_entities: []
      },
      session: {
        session: {
          id: "session-id",
          document: {
            url: "https://example.com",
            files: [],
            transcription: ""
          }
        },
        sources: [],
        persons: [],
        assertions: [],
        citations: []
      },
      freeformNotes: "## Notes\n\nSome notes"
    };

    const serialized = manager.serializeSession(session);
    const reparsed = manager.parseSession(serialized);
    expect(reparsed).toEqual(session);
  });

  it("preserves matched_to links for persons", () => {
    const session: Session = {
      metadata: {
        lineage_type: "research_session",
        title: "Match Test",
        record_type: "census",
        repository: "Archive",
        locator: "https://example.com",
        session_date: "2024-01-15",
        projected_entities: []
      },
      session: {
        session: {
          id: "session-id",
          document: {
            url: "https://example.com",
            files: [],
            transcription: ""
          }
        },
        sources: [],
        persons: [
          {
            id: "p1",
            name: "John O'Connor",
            matched_to: "[[John O'Connor (1871–1938)]]"
          }
        ],
        assertions: [],
        citations: []
      },
      freeformNotes: "## Notes\n\nSome notes"
    };

    const serialized = manager.serializeSession(session);
    const reparsed = manager.parseSession(serialized);
    expect(reparsed.session.persons[0].matched_to).toBe(
      "[[John O'Connor (1871–1938)]]"
    );
  });
});

describe("SessionManager.validateSession", () => {
  it("uses the shared validation contract for blocking checks", () => {
    const session = manager.parseSession(validContent);
    session.metadata.repository = "";

    const result = manager.validateSession(session);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Repository is required.");
  });

  it("keeps URL format issues non-blocking", () => {
    const session = manager.parseSession(validContent);
    session.session.session.document.url = "http://::::";

    const result = manager.validateSession(session);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
