import yaml from "js-yaml";
import { RecordType } from "../types";
import { formatDate } from "../utils/date";
import { generateSessionId } from "../utils/id";

export type SessionTemplateOptions = {
  date?: string;
  recordType?: RecordType;
  repository?: string;
  locator?: string;
  documentUrl?: string;
  documentFiles?: string[];
  // Legacy option kept for backward compatibility with existing callers.
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
  const documentFiles = options.documentFiles ?? (options.documentFile ? [options.documentFile] : []);
  const documentTranscription = options.documentTranscription ?? "";
  const sessionId = generateSessionId();
  const metadata = {
    lineage_type: "research_session",
    title,
    record_type: recordType,
    repository,
    locator,
    session_date: date,
    projected_entities: [] as string[]
  };
  const sessionBlock = {
    session: {
      id: sessionId,
      document: {
        url: documentUrl,
        files: documentFiles,
        transcription: documentTranscription
      }
    },
    sources: [] as unknown[],
    persons: [] as unknown[],
    assertions: [] as unknown[],
    citations: [] as unknown[]
  };
  const frontmatterYaml = yaml
    .dump(metadata, {
      indent: 2,
      lineWidth: 80,
      noRefs: true,
      sortKeys: false
    })
    .trimEnd();
  const sessionYaml = yaml
    .dump(sessionBlock, {
      indent: 2,
      lineWidth: 80,
      noRefs: true,
      sortKeys: false
    })
    .trimEnd();

  return `---
${frontmatterYaml}
---

# ${title}

## Notes


\`\`\`lineage-session
${sessionYaml}
\`\`\`
`;
}
