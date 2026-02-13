import yaml from "js-yaml";
import { App, TFile, TFolder } from "obsidian";
import {
  Assertion,
  AssertionParticipant,
  Citation,
  Person,
  RecordType,
  Session,
  SessionBlock,
  SessionDocument,
  SessionMetadata,
  Source,
  ValidationResult
} from "./types";
import { evaluateSessionValidation } from "./session-validation";
import { buildSessionTemplate } from "./templates/session-template";
import { formatDate } from "./utils/date";
import { slugify } from "./utils/slugify";

const RECORD_TYPES: RecordType[] = [
  "census",
  "vital",
  "church",
  "probate",
  "newspaper",
  "other"
];

export class SessionManager {
  constructor(private app?: App) {}

  parseSession(content: string): Session {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
      throw new Error("No YAML frontmatter found");
    }

    const codeBlockMatch = /```lineage-session[ \t]*\r?\n([\s\S]*?)\r?\n```/.exec(
      content
    );
    if (!codeBlockMatch) {
      throw new Error("No lineage-session code block found");
    }

    const frontmatter = this.parseYaml(frontmatterMatch[1], "frontmatter");
    const sessionData = this.parseYaml(codeBlockMatch[1], "lineage-session");

    const freeformNotes = this.extractFreeformNotes(
      content,
      frontmatterMatch[0].length,
      codeBlockMatch.index ?? content.length
    );

    return this.validateAndTransform(frontmatter, sessionData, freeformNotes);
  }

  serializeSession(session: Session): string {
    const metadata = this.serializeMetadata(session.metadata);
    const frontmatterYaml = yaml
      .dump(metadata, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
        sortKeys: false
      })
      .trimEnd();

    const sessionYaml = yaml
      .dump(session.session, {
        indent: 2,
        lineWidth: 80,
        noRefs: true,
        sortKeys: false
      })
      .trimEnd();

    const notes = session.freeformNotes?.trim()
      ? session.freeformNotes.trim()
      : "## Notes\n\n";

    return `---\n${frontmatterYaml}\n---\n\n${notes}\n\n\`\`\`lineage-session\n${sessionYaml}\n\`\`\`\n`;
  }

  validateSession(session: Session): ValidationResult {
    const result = evaluateSessionValidation(session, { app: this.app });
    const errors = result.issues
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.text);
    return { valid: !result.blocking, errors };
  }

  async createSessionFile(title: string): Promise<TFile> {
    if (!this.app) {
      throw new Error("SessionManager requires an App instance to create files");
    }

    const folder = await this.ensureSessionsFolder();
    const date = formatDate();
    const slug = slugify(title);
    const basePath = `${folder.path}/${date}-${slug}.md`;
    const filePath = this.getUniquePath(basePath);

    const content = buildSessionTemplate(title, { date });
    return this.app.vault.create(filePath, content);
  }

  private parseYaml(source: string, label: string): unknown {
    try {
      const options: yaml.LoadOptions & { maxAliasCount?: number } = {
        schema: yaml.JSON_SCHEMA,
        json: true,
        maxAliasCount: 10,
        onWarning: (warning: unknown) => {
          console.warn(`YAML parsing warning (${label}):`, warning);
        }
      };

      return yaml.load(source, options);
    } catch (error: unknown) {
      if (error instanceof yaml.YAMLException) {
        const line = error.mark?.line ?? 0;
        throw new Error(`YAML parsing failed at line ${line}: ${error.message}`);
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(String(error));
    }
  }

  private extractFreeformNotes(
    content: string,
    startIndex: number,
    endIndex: number
  ): string {
    if (endIndex <= startIndex) {
      return "";
    }

    return content.slice(startIndex, endIndex).trim();
  }

  private validateAndTransform(
    frontmatter: unknown,
    sessionData: unknown,
    freeformNotes: string
  ): Session {
    const metadata = this.parseMetadata(frontmatter);
    const session = this.parseSessionBlock(sessionData);

    return {
      metadata,
      session,
      freeformNotes
    };
  }

  private parseMetadata(value: unknown): SessionMetadata {
    const data = this.ensureRecord(value, "frontmatter");

    const lineageType = this.validateString(
      data.lineage_type,
      "lineage_type",
      "research_session"
    );
    const title = this.validateString(data.title, "title");
    const recordType = this.validateEnum(
      data.record_type,
      "record_type",
      RECORD_TYPES
    );
    const repository = this.validateString(data.repository, "repository");
    const locator = this.validateString(data.locator, "locator");
    const sessionDate = this.validateOptionalDate(data.session_date, "session_date");
    const projectedEntities = this.parseStringArray(
      data.projected_entities,
      "projected_entities"
    );

    return {
      lineage_type: lineageType as SessionMetadata["lineage_type"],
      title,
      record_type: recordType as RecordType,
      repository,
      locator,
      session_date: sessionDate ?? undefined,
      projected_entities: projectedEntities
    };
  }

  private parseSessionBlock(value: unknown): SessionBlock {
    const data = this.ensureRecord(value, "lineage-session");
    const sessionRecord = this.ensureRecord(data.session, "session");
    const sessionId = this.validateString(sessionRecord.id, "session.id");
    const document = this.parseDocument(sessionRecord.document);

    const sources = this.parseTypedArray(data.sources, "sources", (record, index) =>
      this.parseSource(record, index)
    );
    const persons = this.parseTypedArray(data.persons, "persons", (record, index) =>
      this.parsePerson(record, index)
    );
    const assertions = this.parseTypedArray(
      data.assertions,
      "assertions",
      (record, index) => this.parseAssertion(record, index)
    );
    const citations = this.parseTypedArray(
      data.citations,
      "citations",
      (record, index) => this.parseCitation(record, index)
    );

    return {
      session: {
        id: sessionId,
        document
      },
      sources,
      persons,
      assertions,
      citations
    };
  }

  private parseDocument(value: unknown): SessionDocument {
    const record = this.ensureRecord(value, "session.document");
    const url = this.validateOptionalString(record.url, "session.document.url");
    const files = this.parseDocumentFiles(record);
    const transcription = this.validateOptionalString(
      record.transcription,
      "session.document.transcription"
    );

    return {
      url: url ?? "",
      files,
      transcription: transcription ?? ""
    };
  }

  private parseDocumentFiles(record: Record<string, unknown>): string[] {
    if (record.files !== undefined) {
      return this.parseStringArray(record.files, "session.document.files");
    }

    const legacyFile = this.validateOptionalString(record.file, "session.document.file");
    if (!legacyFile) {
      return [];
    }

    return [legacyFile];
  }

  private parseSource(record: Record<string, unknown>, index: number): Source {
    const id = this.validateString(record.id, `sources[${index}].id`);
    return { ...record, id } as Source;
  }

  private parsePerson(record: Record<string, unknown>, index: number): Person {
    const id = this.validateString(record.id, `persons[${index}].id`);
    return { ...record, id } as Person;
  }

  private parseAssertion(
    record: Record<string, unknown>,
    index: number
  ): Assertion {
    const id = this.validateString(record.id, `assertions[${index}].id`);
    const type = this.validateString(record.type, `assertions[${index}].type`);
    const participants = this.parseParticipants(
      record.participants,
      `assertions[${index}].participants`
    );
    const parentRef = this.validateOptionalString(
      record.parent_ref,
      `assertions[${index}].parent_ref`
    );
    const childRef = this.validateOptionalString(
      record.child_ref,
      `assertions[${index}].child_ref`
    );
    const citations = this.parseStringArray(
      record.citations,
      `assertions[${index}].citations`
    );

    const assertion: Assertion = { ...record, id, type } as Assertion;
    if (participants) {
      assertion.participants = participants;
    }
    if (parentRef) {
      assertion.parent_ref = parentRef;
    }
    if (childRef) {
      assertion.child_ref = childRef;
    }
    if (citations.length > 0) {
      assertion.citations = citations;
    }

    return assertion;
  }

  private parseCitation(record: Record<string, unknown>, index: number): Citation {
    const id = this.validateString(record.id, `citations[${index}].id`);
    return { ...record, id } as Citation;
  }

  private parseParticipants(
    value: unknown,
    label: string
  ): AssertionParticipant[] | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Array.isArray(value)) {
      throw new Error(`Expected ${label} to be an array`);
    }

    return value.map((item, index) => {
      const record = this.ensureRecord(item, `${label}[${index}]`);
      const personRef = this.validateString(record.person_ref, `${label}[${index}].person_ref`);
      return { ...record, person_ref: personRef } as AssertionParticipant;
    });
  }

  private parseTypedArray<T>(
    value: unknown,
    label: string,
    parser: (record: Record<string, unknown>, index: number) => T
  ): T[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error(`Expected ${label} to be an array`);
    }

    return value.map((item, index) => {
      const record = this.ensureRecord(item, `${label}[${index}]`);
      return parser(record, index);
    });
  }

  private parseStringArray(value: unknown, label: string): string[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new Error(`Expected ${label} to be an array`);
    }

    return value.map((item, index) =>
      this.validateString(item, `${label}[${index}]`)
    );
  }

  private serializeMetadata(metadata: SessionMetadata): Record<string, unknown> {
    const data: Record<string, unknown> = {
      lineage_type: metadata.lineage_type,
      title: metadata.title,
      record_type: metadata.record_type,
      repository: metadata.repository,
      locator: metadata.locator
    };

    if (metadata.session_date) {
      data.session_date = metadata.session_date;
    }

    data.projected_entities = metadata.projected_entities ?? [];

    return data;
  }

  private validateString(
    value: unknown,
    label: string,
    expected?: string
  ): string {
    if (expected !== undefined && value !== expected) {
      throw new Error(`Expected ${label} to be ${expected}, got ${String(value)}`);
    }

    if (typeof value !== "string") {
      throw new Error(`Expected ${label} to be a string, got ${typeof value}`);
    }

    return value;
  }

  private validateOptionalString(value: unknown, label: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new Error(`Expected ${label} to be a string, got ${typeof value}`);
    }

    return value;
  }

  private validateEnum(
    value: unknown,
    label: string,
    allowed: string[]
  ): string {
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new Error(
        `Invalid ${label}: ${String(value)}. Allowed: ${allowed.join(", ")}`
      );
    }

    return value;
  }

  private validateOptionalDate(value: unknown, label: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value !== "string") {
      throw new Error(`Expected ${label} to be a string, got ${typeof value}`);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      throw new Error(`Invalid ${label} format: ${value}. Expected YYYY-MM-DD`);
    }

    return value;
  }

  private ensureRecord(value: unknown, label: string): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Expected ${label} to be an object`);
    }

    return value as Record<string, unknown>;
  }

  private async ensureSessionsFolder(): Promise<TFolder> {
    if (!this.app) {
      throw new Error("SessionManager requires an App instance to create folders");
    }

    const existing = this.app.vault.getAbstractFileByPath("Sessions");
    if (existing instanceof TFolder) {
      return existing;
    }

    if (existing) {
      throw new Error("Sessions exists and is not a folder");
    }

    return this.app.vault.createFolder("Sessions");
  }

  private getUniquePath(path: string): string {
    if (!this.app) {
      return path;
    }

    if (!this.app.vault.getAbstractFileByPath(path)) {
      return path;
    }

    const base = path.replace(/\.md$/, "");
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(`${base}-${counter}.md`)) {
      counter += 1;
    }

    return `${base}-${counter}.md`;
  }
}
