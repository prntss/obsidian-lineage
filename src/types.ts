export type RecordType =
  | "census"
  | "vital"
  | "church"
  | "probate"
  | "newspaper"
  | "other";

export type SessionMetadata = {
  lineage_type: "research_session";
  title: string;
  record_type: RecordType;
  repository: string;
  locator: string;
  session_date?: string;
  projected_entities: string[];
};

export type SessionDocument = {
  url?: string;
  file?: string;
  transcription?: string;
};

export type SessionCore = {
  id: string;
  document: SessionDocument;
};

export type Source = {
  id: string;
  title?: string;
  record_type?: string;
  repository?: string;
  locator?: string;
  [key: string]: unknown;
};

export type Person = {
  id: string;
  name?: string;
  sex?: string;
  matched_to?: string | null;
  [key: string]: unknown;
};

export type AssertionParticipant = {
  person_ref: string;
  principal?: boolean;
  role?: string;
  [key: string]: unknown;
};

export type Assertion = {
  id: string;
  type: string;
  participants?: AssertionParticipant[];
  parent_ref?: string;
  child_ref?: string;
  citations?: string[];
  [key: string]: unknown;
};

export type Citation = {
  id: string;
  source_id?: string;
  snippet?: string;
  locator?: string;
  [key: string]: unknown;
};

export type SessionBlock = {
  session: SessionCore;
  sources: Source[];
  persons: Person[];
  assertions: Assertion[];
  citations: Citation[];
};

export type Session = {
  metadata: SessionMetadata;
  session: SessionBlock;
  freeformNotes: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
