import { TFile, normalizePath } from "obsidian";
import { Session } from "../../types";
import { buildRelationshipTemplate } from "../../templates/entity-templates";
import { parentChildFilename } from "../../utils/filename";
import { ProjectionContext, ProjectionState, ProjectionSummary } from "../types";
import {
  ensurePersonFile,
  findProjectedRelationship,
  getEntityFolder,
  recordAssertionTarget,
  registerProjectedFile,
  wikilinkForFile
} from "../helpers";
import { createFile, getUniquePath, updateFrontmatter } from "../utils";
import { generateLineageId } from "../../utils/id";

async function ensureParentChildRelationship(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  filename: string,
  data: {
    person_a: string;
    person_b: string;
  }
): Promise<TFile> {
  const folder = getEntityFolder(context.settings, "relationship");
  const basePath = normalizePath(`${folder}/${filename}.md`);
  const projected = findProjectedRelationship(state, {
    relationshipType: "parent-child",
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
      relationship_type: "parent-child",
      person_a: data.person_a,
      person_b: data.person_b,
      person_a_role: "parent",
      person_b_role: "child"
    });
    summary.updated.push(existing.path);
    registerProjectedFile(state, existing);
    return existing;
  }

  const path = getUniquePath(context.app, basePath);
  const content = buildRelationshipTemplate({
    relationship_type: "parent-child",
    person_a: data.person_a,
    person_b: data.person_b,
    person_a_role: "parent",
    person_b_role: "child"
  });
  const file = await createFile(context.app, path, content);
  summary.relationshipsCreated += 1;
  summary.created.push(file.path);
  registerProjectedFile(state, file);
  return file;
}

export async function projectParentChildAssertions(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  session: Session
): Promise<void> {
  const assertions = session.session.assertions.filter(
    (assertion) => assertion.type === "parent-child"
  );
  if (assertions.length === 0) {
    return;
  }

  const personsById = new Map(session.session.persons.map((person) => [person.id, person]));

  for (const assertion of assertions) {
    if (!assertion.parent_ref || !assertion.child_ref) {
      summary.errors.push(
        `Parent-child assertion ${assertion.id} requires parent_ref and child_ref.`
      );
      continue;
    }
    if (assertion.parent_ref === assertion.child_ref) {
      summary.errors.push(
        `Parent-child assertion ${assertion.id} has the same parent and child.`
      );
      continue;
    }

    const parent = personsById.get(assertion.parent_ref);
    const child = personsById.get(assertion.child_ref);
    if (!parent || !child) {
      summary.errors.push(
        `Parent-child assertion ${assertion.id} references missing person.`
      );
      continue;
    }

    const parentFile = await ensurePersonFile(context, state, summary, parent);
    const childFile = await ensurePersonFile(context, state, summary, child);

    const parentLink = wikilinkForFile(parentFile);
    const childLink = wikilinkForFile(childFile);
    const filename = parentChildFilename(parentFile.basename, childFile.basename);

    const relationshipFile = await ensureParentChildRelationship(
      context,
      summary,
      state,
      filename,
      {
        person_a: parentLink,
        person_b: childLink
      }
    );

    recordAssertionTarget(state, assertion.id, "relationship", relationshipFile);
  }
}
