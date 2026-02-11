import { TFile, normalizePath } from "obsidian";
import { Session } from "../../types";
import { buildEventTemplate } from "../../templates/entity-templates";
import { eventFilename, extractYear } from "../../utils/filename";
import { ProjectionContext, ProjectionState, ProjectionSummary } from "../types";
import {
  ensurePersonFile,
  ensurePlaceFile,
  findProjectedEvent,
  getEntityFolder,
  recordAssertionTarget,
  registerProjectedFile,
  wikilinkForFile
} from "../helpers";
import { createFile, getUniquePath, orderParticipants, updateFrontmatter } from "../utils";
import { generateLineageId } from "../../utils/id";

async function ensureResidenceEvent(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  filename: string,
  data: {
    date?: string;
    place: string;
    participants: string[];
  }
): Promise<TFile> {
  const folder = getEntityFolder(context.settings, "event");
  const basePath = normalizePath(`${folder}/${filename}.md`);
  const projected = findProjectedEvent(state, {
    eventType: "residence",
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
      event_type: "residence",
      date: data.date ?? undefined,
      place: data.place,
      participants: data.participants
    });
    summary.updated.push(existing.path);
    registerProjectedFile(state, existing);
    return existing;
  }

  const path = getUniquePath(context.app, basePath);
  const content = buildEventTemplate({
    event_type: "residence",
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

export async function projectResidenceAssertions(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  session: Session
): Promise<void> {
  const assertions = session.session.assertions.filter(
    (assertion) => assertion.type === "residence"
  );
  if (assertions.length === 0) {
    return;
  }

  const personsById = new Map(session.session.persons.map((person) => [person.id, person]));

  for (const assertion of assertions) {
    const participants = orderParticipants(assertion.participants ?? []);
    if (participants.length === 0) {
      summary.errors.push(`Residence assertion ${assertion.id} has no participants.`);
      continue;
    }

    const placeValue = typeof assertion.place === "string" ? assertion.place : "";
    if (!placeValue.trim()) {
      summary.errors.push(`Residence assertion ${assertion.id} requires a place.`);
      continue;
    }

    const participantFiles: TFile[] = [];
    for (const participant of participants) {
      const person = personsById.get(participant.person_ref);
      if (!person) {
        summary.errors.push(
          `Residence assertion references missing person ${participant.person_ref}.`
        );
        continue;
      }
      const file = await ensurePersonFile(context, state, summary, person);
      participantFiles.push(file);
    }

    if (participantFiles.length === 0) {
      continue;
    }

    const placeFile = await ensurePlaceFile(context, summary, placeValue, state);
    const placeLink = wikilinkForFile(placeFile);
    const date = typeof assertion.date === "string" ? assertion.date : undefined;
    const year = extractYear(date ?? undefined);
    const principalName = participantFiles[0].basename;
    const participantsLinks = participantFiles.map((file) => wikilinkForFile(file));
    const filename = eventFilename("residence", principalName, year ?? undefined);
    const eventFile = await ensureResidenceEvent(context, summary, state, filename, {
      date,
      place: placeLink,
      participants: participantsLinks
    });

    recordAssertionTarget(state, assertion.id, "event", eventFile);
  }
}
