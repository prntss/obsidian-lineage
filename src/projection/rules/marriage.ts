import { TFile, normalizePath } from "obsidian";
import { Session } from "../../types";
import { buildEventTemplate, buildRelationshipTemplate } from "../../templates/entity-templates";
import { eventFilename, extractYear, relationshipFilename } from "../../utils/filename";
import { ProjectionContext, ProjectionState, ProjectionSummary } from "../types";
import {
  ensurePersonFile,
  ensurePlaceFile,
  findProjectedEvent,
  findProjectedRelationship,
  getEntityFolder,
  recordAssertionTarget,
  registerProjectedFile,
  wikilinkForFile
} from "../helpers";
import { createFile, getUniquePath, orderParticipants, updateFrontmatter } from "../utils";
import { generateLineageId } from "../../utils/id";

async function ensureRelationshipFile(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  filename: string,
  data: {
    relationship_type: string;
    person_a: string;
    person_b: string;
    date?: string;
    place?: string;
    person_a_role?: string;
    person_b_role?: string;
  }
): Promise<TFile> {
  const folder = getEntityFolder(context.settings, "relationship");
  const basePath = normalizePath(`${folder}/${filename}.md`);
  const projected = findProjectedRelationship(state, {
    relationshipType: data.relationship_type,
    personA: data.person_a,
    personB: data.person_b
  });
  const existingByPath = context.app.vault.getAbstractFileByPath(basePath);
  const existing =
    projected ?? (existingByPath instanceof TFile ? existingByPath : null);
  if (existing) {
    const cache = context.app.metadataCache.getFileCache(existing);
    const existingId = cache?.frontmatter?.lineage_id;
    await updateFrontmatter(context.app, existing, {
      lineage_type: "relationship",
      lineage_id: existingId ?? generateLineageId(),
      relationship_type: data.relationship_type,
      person_a: data.person_a,
      person_b: data.person_b,
      person_a_role: data.person_a_role ?? undefined,
      person_b_role: data.person_b_role ?? undefined,
      date: data.date ?? undefined,
      place: data.place ?? undefined
    });
    summary.updated.push(existing.path);
    registerProjectedFile(state, existing);
    return existing;
  }

  const path = getUniquePath(context.app, basePath);
  const content = buildRelationshipTemplate({
    relationship_type: data.relationship_type,
    person_a: data.person_a,
    person_b: data.person_b,
    person_a_role: data.person_a_role,
    person_b_role: data.person_b_role,
    date: data.date,
    place: data.place
  });
  const file = await createFile(context.app, path, content);
  summary.relationshipsCreated += 1;
  summary.created.push(file.path);
  registerProjectedFile(state, file);
  return file;
}

async function ensureMarriageEventFile(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  filename: string,
  data: {
    date?: string;
    place?: string;
    participants: string[];
  }
): Promise<TFile> {
  const folder = getEntityFolder(context.settings, "event");
  const basePath = normalizePath(`${folder}/${filename}.md`);
  const projected = findProjectedEvent(state, {
    eventType: "marriage",
    participants: data.participants,
    date: data.date,
    place: data.place
  });
  const existingByPath = context.app.vault.getAbstractFileByPath(basePath);
  const existing =
    projected ?? (existingByPath instanceof TFile ? existingByPath : null);
  if (existing) {
    const cache = context.app.metadataCache.getFileCache(existing);
    const existingId = cache?.frontmatter?.lineage_id;
    await updateFrontmatter(context.app, existing, {
      lineage_type: "event",
      lineage_id: existingId ?? generateLineageId(),
      event_type: "marriage",
      date: data.date ?? undefined,
      place: data.place ?? undefined,
      participants: data.participants
    });
    summary.updated.push(existing.path);
    registerProjectedFile(state, existing);
    return existing;
  }

  const path = getUniquePath(context.app, basePath);
  const content = buildEventTemplate({
    event_type: "marriage",
    date: data.date,
    place: data.place,
    participants: data.participants
  });
  const file = await createFile(context.app, path, content);
  summary.eventsCreated += 1;
  summary.created.push(file.path);
  registerProjectedFile(state, file);
  return file;
}

export async function projectMarriageAssertions(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  session: Session
): Promise<void> {
  const assertions = session.session.assertions.filter(
    (assertion) => assertion.type === "marriage"
  );
  if (assertions.length === 0) {
    return;
  }

  const personsById = new Map(session.session.persons.map((person) => [person.id, person]));

  for (const assertion of assertions) {
    const participants = orderParticipants(assertion.participants ?? []);
    if (participants.length < 2) {
      continue;
    }

    const participantFiles: TFile[] = [];
    for (const participant of participants) {
      const person = personsById.get(participant.person_ref);
      if (!person) {
        summary.errors.push(`Marriage assertion references missing person ${participant.person_ref}.`);
        continue;
      }
      const file = await ensurePersonFile(context, state, summary, person);
      participantFiles.push(file);
    }

    if (participantFiles.length < 2) {
      continue;
    }

    const personA = wikilinkForFile(participantFiles[0]);
    const personB = wikilinkForFile(participantFiles[1]);
    const date = typeof assertion.date === "string" ? assertion.date : undefined;
    const year = extractYear(date ?? undefined);
    const placeValue = typeof assertion.place === "string" ? assertion.place : undefined;
    let placeLink: string | undefined;
    if (placeValue) {
      const placeFile = await ensurePlaceFile(context, summary, placeValue, state);
      placeLink = wikilinkForFile(placeFile);
    }

    const relationshipName = relationshipFilename(participantFiles[0].basename, participantFiles[1].basename);
    const relationshipFile = await ensureRelationshipFile(context, summary, state, relationshipName, {
      relationship_type: "spouse",
      person_a: personA,
      person_b: personB,
      date,
      place: placeLink
    });
    recordAssertionTarget(state, assertion.id, "relationship", relationshipFile);

    if (date || placeLink) {
      const eventName = eventFilename("marriage", participantFiles[0].basename, year ?? undefined);
      const eventFile = await ensureMarriageEventFile(context, summary, state, eventName, {
        date,
        place: placeLink,
        participants: [personA, personB]
      });
      recordAssertionTarget(state, assertion.id, "event", eventFile);
    }
  }
}
