import { RecordType } from "../types";
import { formatDate } from "../utils/date";
import { generateSessionId } from "../utils/id";

export type SessionTemplateOptions = {
  date?: string;
  recordType?: RecordType;
  repository?: string;
  locator?: string;
  documentUrl?: string;
  documentFile?: string;
  documentTranscription?: string;
};

export function buildSessionTemplate(
  title: string,
  options: SessionTemplateOptions = {}
): string {
  const date = options.date ?? formatDate();
  const recordType = options.recordType ?? "other";
  const repository = options.repository ?? "";
  const locator = options.locator ?? "";
  const documentUrl = options.documentUrl ?? "";
  const documentFile = options.documentFile ?? "";
  const documentTranscription = options.documentTranscription ?? "";
  const sessionId = generateSessionId();

  return `---
lineage_type: research_session
title: "${title}"
record_type: ${recordType}
repository: "${repository}"
locator: "${locator}"
session_date: ${date}
projected_entities: []
---

# ${title}

## Notes


\`\`\`lineage-session
session:
  id: ${sessionId}
  document:
    url: "${documentUrl}"
    file: "${documentFile}"
    transcription: |
      ${documentTranscription}
sources: []
persons: []
assertions: []
citations: []
\`\`\`
`;
}
