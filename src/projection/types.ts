import { App, TFile } from "obsidian";
import { LineageSettings } from "../settings";
import { VaultIndexer } from "../vault-indexer";

export type ProjectionSummary = {
  personsCreated: number;
  personsUpdated: number;
  eventsCreated: number;
  relationshipsCreated: number;
  placesCreated: number;
  created: string[];
  updated: string[];
  errors: string[];
};

export type ProjectionTargetType = "person" | "event" | "relationship";

export type ProjectionTarget = {
  type: ProjectionTargetType;
  file: TFile;
};

export type ProjectedEntity = {
  file: TFile;
  lineage_type: string;
  lineage_id?: string;
  name?: string;
  title?: string;
  record_type?: string;
  repository?: string;
  event_type?: string;
  date?: string;
  place?: string;
  participants?: string[];
  relationship_type?: string;
  person_a?: string;
  person_b?: string;
};

export type ProjectedEntityIndex = {
  entries: ProjectedEntity[];
  byLineageId: Map<string, ProjectedEntity>;
};

export type ProjectionContext = {
  app: App;
  settings: LineageSettings;
  vaultIndexer: VaultIndexer;
};

export type ProjectionState = {
  personFiles: Map<string, TFile>;
  assertionTargets: Map<string, ProjectionTarget[]>;
  projectedFiles: Map<string, TFile>;
  projectedEntities: ProjectedEntityIndex;
};

export function createEmptySummary(): ProjectionSummary {
  return {
    personsCreated: 0,
    personsUpdated: 0,
    eventsCreated: 0,
    relationshipsCreated: 0,
    placesCreated: 0,
    created: [],
    updated: [],
    errors: []
  };
}
