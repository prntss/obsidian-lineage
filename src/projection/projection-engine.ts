import { TFile } from "obsidian";
import { Session } from "../types";
import { buildProjectedEntityIndex, ensureBaseFolders } from "./helpers";
import { projectBirthDeathAssertions } from "./rules/birth-death";
import { projectCitations } from "./rules/citations";
import { projectIdentityAssertions } from "./rules/identity";
import { projectMarriageAssertions } from "./rules/marriage";
import { projectParentChildAssertions } from "./rules/parent-child";
import { projectResidenceAssertions } from "./rules/residence";
import { ProjectionContext, ProjectionState, createEmptySummary } from "./types";
import { updateFrontmatter } from "./utils";

export class ProjectionEngine {
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

    await projectIdentityAssertions(this.context, summary, state, session);
    await projectBirthDeathAssertions(this.context, summary, state, session);
    await projectMarriageAssertions(this.context, summary, state, session);
    await projectParentChildAssertions(this.context, summary, state, session);
    await projectResidenceAssertions(this.context, summary, state, session);
    await projectCitations(this.context, summary, state, session);

    if (sessionFile) {
      await this.updateProjectedEntities(sessionFile, state);
    }

    return summary;
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
