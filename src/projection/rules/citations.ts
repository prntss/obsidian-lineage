import { TFile, normalizePath } from "obsidian";
import { Assertion, Citation as SessionCitation, Session } from "../../types";
import { buildCitationTemplate, buildSourceTemplate } from "../../templates/entity-templates";
import { generateLineageId } from "../../utils/id";
import { citationFilename, sanitizeFilename } from "../../utils/filename";
import { ProjectionContext, ProjectionState, ProjectionSummary } from "../types";
import { getEntityFolder, registerProjectedFile } from "../helpers";
import { createFile, getUniquePath, updateFrontmatter } from "../utils";

type SourceMatchKey = {
  title: string;
  record_type?: string;
  repository?: string;
  locator?: string;
  date?: string;
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function findExistingSource(
  context: ProjectionContext,
  key: SourceMatchKey
): TFile | null {
  const normalizedTitle = normalize(key.title);
  const normalizedRecord = normalize(key.record_type);
  const normalizedRepo = normalize(key.repository);

  for (const file of context.app.vault.getMarkdownFiles()) {
    const cache = context.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter || frontmatter.lineage_type !== "source") {
      continue;
    }

    const title = normalize(frontmatter.title);
    const recordType = normalize(frontmatter.record_type);
    const repository = normalize(frontmatter.repository);

    if (title !== normalizedTitle) {
      continue;
    }
    if (normalizedRecord && recordType !== normalizedRecord) {
      continue;
    }
    if (normalizedRepo && repository !== normalizedRepo) {
      continue;
    }

    return file;
  }

  return null;
}

async function ensureSourceFile(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  key: SourceMatchKey
): Promise<TFile> {
  const existing = findExistingSource(context, key);
  if (existing) {
    const cache = context.app.metadataCache.getFileCache(existing);
    const existingId = cache?.frontmatter?.lineage_id;
    if (!existingId) {
      await updateFrontmatter(context.app, existing, {
        lineage_type: "source",
        lineage_id: generateLineageId()
      });
    }
    registerProjectedFile(state, existing);
    return existing;
  }

  const folder = getEntityFolder(context.settings, "source");
  const filename = sanitizeFilename(key.title || "Source");
  const path = getUniquePath(context.app, normalizePath(`${folder}/${filename}.md`));
  const content = buildSourceTemplate({
    title: key.title,
    record_type: key.record_type,
    repository: key.repository,
    locator: key.locator,
    date: key.date
  });
  const file = await createFile(context.app, path, content);
  summary.created.push(file.path);
  registerProjectedFile(state, file);
  return file;
}

function resolveCitation(
  assertion: Assertion,
  citationsById: Map<string, SessionCitation>
): { snippet?: string; locator?: string } {
  const citationId = assertion.citations?.[0];
  if (!citationId) {
    return {};
  }
  const citation = citationsById.get(citationId);
  if (!citation) {
    return {};
  }
  return {
    snippet: typeof citation.snippet === "string" ? citation.snippet : undefined,
    locator: typeof citation.locator === "string" ? citation.locator : undefined
  };
}

function resolveTargetLabel(targetFile: TFile, frontmatter?: Record<string, unknown>): string {
  if (frontmatter) {
    if (typeof frontmatter.name === "string" && frontmatter.name.trim()) {
      return frontmatter.name;
    }
    if (typeof frontmatter.title === "string" && frontmatter.title.trim()) {
      return frontmatter.title;
    }
  }
  return targetFile.basename;
}

async function ensureCitationFile(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  sourceId: string,
  sourceTitle: string,
  targetFile: TFile,
  targetType: "person" | "event" | "relationship",
  assertionId: string,
  snippet?: string,
  locator?: string
): Promise<void> {
  const cache = context.app.metadataCache.getFileCache(targetFile);
  const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
  let targetId =
    typeof frontmatter?.lineage_id === "string" ? frontmatter.lineage_id : undefined;

  if (!targetId) {
    targetId = generateLineageId();
    await updateFrontmatter(context.app, targetFile, {
      lineage_type: targetType,
      lineage_id: targetId
    });
  }

  const targetLabel = resolveTargetLabel(targetFile, frontmatter);
  const filename = citationFilename(sourceTitle, targetLabel, assertionId);
  const folder = getEntityFolder(context.settings, "citation");
  const path = normalizePath(`${folder}/${filename}.md`);
  const existing = context.app.vault.getAbstractFileByPath(path);
  const existingFile = existing instanceof TFile ? existing : null;
  const existingCache = existingFile
    ? context.app.metadataCache.getFileCache(existingFile)
    : null;
  const existingId = existingCache?.frontmatter?.lineage_id;

  const content = buildCitationTemplate({
    lineage_id: typeof existingId === "string" ? existingId : undefined,
    source_id: sourceId,
    target_entity_id: targetId,
    target_entity_type: targetType,
    assertion_id: assertionId,
    snippet,
    locator
  });

  if (existingFile) {
    await context.app.vault.modify(existingFile, content);
    summary.updated.push(existingFile.path);
    registerProjectedFile(state, existingFile);
    return;
  }

  const file = await createFile(context.app, path, content);
  summary.created.push(file.path);
  registerProjectedFile(state, file);
}

export async function projectCitations(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  session: Session
): Promise<void> {
  if (session.session.assertions.length === 0) {
    return;
  }

  const title = session.metadata.title?.trim();
  if (!title) {
    summary.errors.push("Session title required for Source creation.");
    return;
  }

  const sourceFile = await ensureSourceFile(context, summary, state, {
    title,
    record_type: session.metadata.record_type,
    repository: session.metadata.repository,
    locator: session.metadata.locator,
    date: session.metadata.session_date
  });

  const sourceCache = context.app.metadataCache.getFileCache(sourceFile);
  const sourceId =
    typeof sourceCache?.frontmatter?.lineage_id === "string"
      ? sourceCache.frontmatter.lineage_id
      : generateLineageId();

  if (!sourceCache?.frontmatter?.lineage_id) {
    await updateFrontmatter(context.app, sourceFile, {
      lineage_type: "source",
      lineage_id: sourceId
    });
  }

  const citationsById = new Map(
    session.session.citations.map((citation) => [citation.id, citation])
  );

  for (const assertion of session.session.assertions) {
    const targets = state.assertionTargets.get(assertion.id) ?? [];
    if (targets.length === 0) {
      continue;
    }

    const { snippet, locator } = resolveCitation(assertion, citationsById);

    for (const target of targets) {
      await ensureCitationFile(
        context,
        summary,
        state,
        sourceId,
        title,
        target.file,
        target.type,
        assertion.id,
        snippet,
        locator
      );
    }
  }
}
