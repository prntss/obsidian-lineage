import { App, Modal, Notice, Setting } from "obsidian";
import LineagePlugin from "./main";
import { ProjectionEngine } from "./projection/projection-engine";
import { evaluateSessionValidation } from "./session-validation";

class SessionTitleModal extends Modal {
  private value = "";
  private submitted = false;

  constructor(app: App, private resolve: (value: string | null) => void) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Create Research Session" });

    new Setting(contentEl)
      .setName("Session title")
      .addText((text) => {
        text.setPlaceholder("1901 Census - O'Connor Family");
        text.onChange((value) => {
          this.value = value;
        });
        text.inputEl.focus();
      });

    new Setting(contentEl).addButton((button) => {
      button.setButtonText("Create").setCta();
      button.onClick(() => {
        this.submitted = true;
        const trimmed = this.value.trim();
        this.close();
        this.resolve(trimmed.length > 0 ? trimmed : null);
      });
    });

    new Setting(contentEl).addButton((button) => {
      button.setButtonText("Cancel");
      button.onClick(() => {
        this.close();
      });
    });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.submitted) {
      this.resolve(null);
    }
  }
}

async function promptForSessionTitle(app: App): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new SessionTitleModal(app, resolve);
    modal.open();
  });
}

export function registerCommands(plugin: LineagePlugin): void {
  plugin.addCommand({
    id: "lineage-create-session",
    name: "Create Research Session",
    callback: async () => {
      const title = await promptForSessionTitle(plugin.app);
      if (!title) {
        return;
      }

      try {
        const file = await plugin.sessionManager.createSessionFile(title);
        await plugin.app.workspace.getLeaf(false).openFile(file, { active: true });
        new Notice(`Created research session: ${file.basename}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Failed to create session: ${message}`);
      }
    }
  });

  plugin.addCommand({
    id: "lineage-project-session",
    name: "Project Session",
    callback: async () => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file) {
        new Notice("No active session file.");
        return;
      }

      try {
        const content = await plugin.app.vault.read(file);
        const session = plugin.sessionManager.parseSession(content);
        const validation = evaluateSessionValidation(session, { app: plugin.app });
        if (validation.blocking) {
          const first = validation.issues.find((issue) => issue.level === "error");
          new Notice(
            `Projection blocked: ${first?.text ?? "Fix session errors before projecting."}`
          );
          return;
        }
        const engine = new ProjectionEngine({
          app: plugin.app,
          settings: plugin.settings,
          vaultIndexer: plugin.vaultIndexer
        });
        const summary = await engine.projectSession(session, file);

        const createdCount = summary.created.length;
        const updatedCount = summary.updated.length;
        const noteCount = summary.notes.length;
        const errorCount = summary.errors.length;
        if (errorCount) {
          console.warn("Projection errors:", summary.errors);
        }
        if (noteCount) {
          console.info("Projection notes:", summary.notes);
        }

        new Notice(
          `Projection complete: ${createdCount} created, ${updatedCount} updated${noteCount ? `, ${noteCount} notes` : ""}${errorCount ? `, ${errorCount} errors` : ""}.`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`Projection failed: ${message}`);
      }
    }
  });

  plugin.addCommand({
    id: "lineage-open-session-panel",
    name: "Open Lineage Session Panel",
    callback: async () => {
      await plugin.activateSessionView();
    }
  });
}
