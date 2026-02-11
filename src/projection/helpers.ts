import { App, TFile, normalizePath } from "obsidian";
import { LineageSettings, ensureEntityFolders, normalizeBaseFolder } from "../settings";
import { buildPersonTemplate, buildPlaceTemplate } from "../templates/entity-templates";
import { generateLineageId } from "../utils/id";
import { personFilename, placeFilename } from "../utils/filename";
import { Person, Session } from "../types";
import {
  createFile,
  extractLinkTarget,
  formatWikilink,
  getUniquePath,
  updateFrontmatter
} from "./utils";
import {
  ProjectedEntity,
  ProjectedEntityIndex,
  ProjectionContext,
  ProjectionState,
  ProjectionSummary,
  ProjectionTargetType
} from "./types";

export const ENTITY_SUBFOLDERS = {
  person: "People",
  place: "Places",
  event: "Events",
  relationship: "Relationships",
  source: "Sources",
  citation: "Citations"
} as const;

export function buildProjectedEntityIndex(
  context: ProjectionContext,
  session: Session
): ProjectedEntityIndex {
  const entries: ProjectedEntity[] = [];
  const byLineageId = new Map<string, ProjectedEntity>();

  for (const link of session.metadata.projected_entities ?? []) {
    const file = resolveLinkFile(context.app, link);
    if (!file) {
      continue;
    }
    const cache = context.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter || typeof frontmatter.lineage_type !== "string") {
      continue;
    }

    const entry: ProjectedEntity = {
      file,
      lineage_type: frontmatter.lineage_type,
      lineage_id:
        typeof frontmatter.lineage_id === "string" ? frontmatter.lineage_id : undefined,
      name: typeof frontmatter.name === "string" ? frontmatter.name : undefined,
      title: typeof frontmatter.title === "string" ? frontmatter.title : undefined,
      record_type:
        typeof frontmatter.record_type === "string" ? frontmatter.record_type : undefined,
      repository:
        typeof frontmatter.repository === "string" ? frontmatter.repository : undefined,
      event_type:
        typeof frontmatter.event_type === "string" ? frontmatter.event_type : undefined,
      date: typeof frontmatter.date === "string" ? frontmatter.date : undefined,
      place: typeof frontmatter.place === "string" ? frontmatter.place : undefined,
      participants: Array.isArray(frontmatter.participants)
        ? frontmatter.participants.filter((value: unknown) => typeof value === "string")
        : undefined,
      relationship_type:
        typeof frontmatter.relationship_type === "string"
          ? frontmatter.relationship_type
          : undefined,
      person_a:
        typeof frontmatter.person_a === "string" ? frontmatter.person_a : undefined,
      person_b:
        typeof frontmatter.person_b === "string" ? frontmatter.person_b : undefined
    };
    entries.push(entry);
    if (entry.lineage_id) {
      byLineageId.set(entry.lineage_id, entry);
    }
  }

  return { entries, byLineageId };
}

export function registerProjectedFile(state: ProjectionState, file: TFile): void {
  state.projectedFiles.set(file.path, file);
}

export function recordAssertionTarget(
  state: ProjectionState,
  assertionId: string,
  type: ProjectionTargetType,
  file: TFile
): void {
  const list = state.assertionTargets.get(assertionId) ?? [];
  list.push({ type, file });
  state.assertionTargets.set(assertionId, list);
}

function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLinkValue(value: string): string {
  return normalizeValue(extractLinkTarget(value));
}

function normalizeParticipants(participants: string[]): string[] {
  return participants.map((value) => normalizeLinkValue(value)).sort();
}

export function findProjectedPerson(
  state: ProjectionState,
  name: string
): TFile | null {
  const normalized = normalizeValue(name);
  for (const entry of state.projectedEntities.entries) {
    if (entry.lineage_type !== "person") {
      continue;
    }
    const candidateName = entry.name ?? entry.file.basename;
    if (normalizeValue(candidateName) === normalized) {
      return entry.file;
    }
  }
  return null;
}

export function findProjectedEvent(
  state: ProjectionState,
  params: {
    eventType: string;
    participants: string[];
    date?: string;
    place?: string;
  }
): TFile | null {
  const normalizedParticipants = normalizeParticipants(params.participants);
  const normalizedPlace = params.place ? normalizeLinkValue(params.place) : null;
  for (const entry of state.projectedEntities.entries) {
    if (entry.lineage_type !== "event") {
      continue;
    }
    if (entry.event_type !== params.eventType) {
      continue;
    }
    const entryParticipants = entry.participants
      ? normalizeParticipants(entry.participants)
      : [];
    if (entryParticipants.join("|") !== normalizedParticipants.join("|")) {
      continue;
    }
    if (params.date && entry.date) {
      if (entry.date !== params.date) {
        continue;
      }
    }
    if (normalizedPlace && entry.place) {
      if (normalizeLinkValue(entry.place) !== normalizedPlace) {
        continue;
      }
    }
    return entry.file;
  }
  return null;
}

export function findProjectedRelationship(
  state: ProjectionState,
  params: {
    relationshipType: string;
    personA: string;
    personB: string;
  }
): TFile | null {
  const normalizedA = normalizeLinkValue(params.personA);
  const normalizedB = normalizeLinkValue(params.personB);
  for (const entry of state.projectedEntities.entries) {
    if (entry.lineage_type !== "relationship") {
      continue;
    }
    if (entry.relationship_type !== params.relationshipType) {
      continue;
    }
    if (!entry.person_a || !entry.person_b) {
      continue;
    }
    if (
      normalizeLinkValue(entry.person_a) === normalizedA &&
      normalizeLinkValue(entry.person_b) === normalizedB
    ) {
      return entry.file;
    }
  }
  return null;
}

export function findProjectedSource(
  state: ProjectionState,
  params: {
    title: string;
    recordType?: string;
    repository?: string;
  }
): TFile | null {
  const normalizedTitle = normalizeValue(params.title);
  const normalizedRecord = params.recordType ? normalizeValue(params.recordType) : "";
  const normalizedRepo = params.repository ? normalizeValue(params.repository) : "";
  for (const entry of state.projectedEntities.entries) {
    if (entry.lineage_type !== "source") {
      continue;
    }
    const entryTitle = entry.title ?? entry.file.basename;
    if (normalizeValue(entryTitle) !== normalizedTitle) {
      continue;
    }
    const entryRecord = entry.record_type ? normalizeValue(entry.record_type) : "";
    const entryRepo = entry.repository ? normalizeValue(entry.repository) : "";
    if (normalizedRecord && entryRecord !== normalizedRecord) {
      continue;
    }
    if (normalizedRepo && entryRepo !== normalizedRepo) {
      continue;
    }
    return entry.file;
  }
  return null;
}

export function findFileByLineageId(app: App, lineageId: string): TFile | null {
  const normalized = lineageId.trim();
  if (!normalized) {
    return null;
  }
  for (const file of app.vault.getMarkdownFiles()) {
    const cache = app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (frontmatter?.lineage_id === normalized) {
      return file;
    }
  }
  return null;
}

export function getBaseFolder(settings: LineageSettings): string {
  return normalizeBaseFolder(settings.baseFolder);
}

export function getEntityFolder(settings: LineageSettings, type: keyof typeof ENTITY_SUBFOLDERS): string {
  const base = getBaseFolder(settings);
  return normalizePath(`${base}/${ENTITY_SUBFOLDERS[type]}`);
}

export async function ensureBaseFolders(app: App, settings: LineageSettings): Promise<void> {
  await ensureEntityFolders(app, getBaseFolder(settings), Object.values(ENTITY_SUBFOLDERS));
}

export function resolveLinkFile(app: App, link: string): TFile | null {
  const target = extractLinkTarget(link);
  if (!target) {
    return null;
  }
  return app.metadataCache.getFirstLinkpathDest(target, "") ?? null;
}

export async function ensurePersonFile(
  context: ProjectionContext,
  state: ProjectionState,
  summary: ProjectionSummary,
  person: Person
): Promise<TFile> {
  const cached = state.personFiles.get(person.id);
  if (cached) {
    return cached;
  }

  const name = person.name?.trim() || "Unknown Person";
  const matched = person.matched_to ? resolveLinkFile(context.app, person.matched_to) : null;
  const lineageId =
    typeof person.lineage_id === "string" ? person.lineage_id : undefined;

  const projected = !matched ? findProjectedPerson(state, name) : null;
  const lineageMatch =
    !matched && !projected && lineageId
      ? findFileByLineageId(context.app, lineageId)
      : null;

  const existing = matched ?? projected ?? lineageMatch;
  if (existing) {
    const cache = context.app.metadataCache.getFileCache(existing);
    const existingId = cache?.frontmatter?.lineage_id;
    await updateFrontmatter(context.app, existing, {
      lineage_type: "person",
      lineage_id: existingId ?? generateLineageId(),
      name,
      sex: person.sex ?? undefined
    });
    summary.personsUpdated += 1;
    summary.updated.push(existing.path);
    state.personFiles.set(person.id, existing);
    registerProjectedFile(state, existing);
    return existing;
  }

  const baseFolder = getEntityFolder(context.settings, "person");
  const filename = personFilename(name);
  const path = getUniquePath(context.app, `${baseFolder}/${filename}.md`);
  const content = buildPersonTemplate({ name, sex: person.sex });
  const file = await createFile(context.app, path, content);
  summary.personsCreated += 1;
  summary.created.push(file.path);
  state.personFiles.set(person.id, file);
  registerProjectedFile(state, file);
  return file;
}

export async function ensurePlaceFile(
  context: ProjectionContext,
  summary: ProjectionSummary,
  place: string,
  state?: ProjectionState
): Promise<TFile> {
  const target = extractLinkTarget(place);
  const direct = resolveLinkFile(context.app, target);
  if (direct) {
    return direct;
  }

  const matches = context.vaultIndexer.findPlacesByName(target);
  if (matches.length > 0) {
    return matches[0];
  }

  const baseFolder = getEntityFolder(context.settings, "place");
  const filename = placeFilename(target);
  const path = getUniquePath(context.app, `${baseFolder}/${filename}.md`);
  const content = buildPlaceTemplate({ name: target });
  const file = await createFile(context.app, path, content);
  summary.placesCreated += 1;
  summary.created.push(file.path);
  if (state) {
    registerProjectedFile(state, file);
  }
  return file;
}

export function wikilinkForFile(file: TFile): string {
  return formatWikilink(file.basename);
}
