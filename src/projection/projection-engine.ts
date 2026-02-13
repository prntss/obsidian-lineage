import { TFile } from "obsidian";
import { Session } from "../types";
import {
  buildProjectedEntityIndex,
  ensureBaseFolders,
  ensurePersonFile,
  wikilinkForFile
} from "./helpers";
import { projectBirthDeathAssertions } from "./rules/birth-death";
import { projectCitations } from "./rules/citations";
import { projectIdentityAssertions } from "./rules/identity";
import { projectMarriageAssertions } from "./rules/marriage";
import { projectParentChildAssertions } from "./rules/parent-child";
import { projectResidenceAssertions } from "./rules/residence";
import {
  ProjectionContext,
  ProjectionState,
  ProjectionSummary,
  createEmptySummary
} from "./types";
import { updateFrontmatter } from "./utils";

export class ProjectionEngine {
  private static readonly SUPPORTED_ASSERTION_TYPES = new Set([
    "identity",
    "birth",
    "death",
    "marriage",
    "parent-child",
    "residence"
  ]);

  constructor(private context: ProjectionContext) {}

  async projectSession(session: Session, sessionFile?: TFile) {
    const summary = createEmptySummary();
    const state: ProjectionState = {
      personFiles: new Map(),
      assertionTargets: new Map(),
      projectedFiles: new Map(),
      projectedEntities: buildProjectedEntityIndex(this.context, session)
    };

    await ensureBaseFolders(this.context.app, this.context.settings);
    await this.projectSessionPersons(summary, state, session, sessionFile);

    await projectIdentityAssertions(this.context, summary, state, session);
    await projectBirthDeathAssertions(this.context, summary, state, session);
    await projectMarriageAssertions(this.context, summary, state, session);
    await projectParentChildAssertions(this.context, summary, state, session);
    await projectResidenceAssertions(this.context, summary, state, session);
    await projectCitations(this.context, summary, state, session);
    this.appendProjectionCoverageNotes(summary, session);

    if (sessionFile) {
      await this.updateProjectedEntities(sessionFile, state);
    }

    return summary;
  }

  private async projectSessionPersons(
    summary: ProjectionSummary,
    state: ProjectionState,
    session: Session,
    sessionFile?: TFile
  ): Promise<void> {
    for (const person of session.session.persons) {
      const file = await ensurePersonFile(this.context, state, summary, person);
      if (!person.matched_to?.trim()) {
        person.matched_to = this.linkForSessionFile(file, sessionFile);
      }
    }
  }

  private linkForSessionFile(file: TFile, sessionFile?: TFile): string {
    if (sessionFile && this.context.app.fileManager?.generateMarkdownLink) {
      return this.context.app.fileManager.generateMarkdownLink(file, sessionFile.path);
    }
    return wikilinkForFile(file);
  }

  private appendProjectionCoverageNotes(
    summary: ProjectionSummary,
    session: Session
  ): void {
    const unsupportedCounts = new Map<string, number>();
    for (const assertion of session.session.assertions) {
      if (ProjectionEngine.SUPPORTED_ASSERTION_TYPES.has(assertion.type)) {
        continue;
      }
      const count = unsupportedCounts.get(assertion.type) ?? 0;
      unsupportedCounts.set(assertion.type, count + 1);
    }

    for (const [type, count] of unsupportedCounts) {
      summary.notes.push(
        `${count} ${type} assertion${count === 1 ? "" : "s"} not projected by design.`
      );
    }
  }

  private async updateProjectedEntities(
    sessionFile: TFile,
    state: ProjectionState
  ): Promise<void> {
    const files = Array.from(state.projectedFiles.values());
    const sorted = files.sort((a, b) => a.path.localeCompare(b.path));
    const links = sorted.map((file) =>
      this.context.app.fileManager?.generateMarkdownLink
        ? this.context.app.fileManager.generateMarkdownLink(file, sessionFile.path)
        : `[[${file.basename}]]`
    );

    await updateFrontmatter(this.context.app, sessionFile, {
      projected_entities: links
    });
  }
}
