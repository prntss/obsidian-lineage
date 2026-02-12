import {
  AbstractInputSuggest,
  App,
  FuzzySuggestModal,
  ItemView,
  Modal,
  Notice,
  TFile,
  ViewStateResult,
  WorkspaceLeaf
} from "obsidian";
import { computeCompositeScore, scoreName } from "../duplicate-matcher";
import { LineageSettings } from "../settings";
import { SessionManager } from "../session-manager";
import { Assertion, Person, Session } from "../types";
import { VaultIndexer } from "../vault-indexer";
import { ProjectionEngine } from "../projection/projection-engine";
import { ProjectionSummary, createEmptySummary } from "../projection/types";

export const VIEW_TYPE_SESSION = "lineage-session-view";

export class SessionView extends ItemView {
  private currentFile: TFile | null = null;
  private currentSession: Session | null = null;
  private activeLeafTimeout: number | null = null;
  private metadataTimeout: number | null = null;
  private saveTimeout: number | null = null;
  private idleSaveTimeout: number | null = null;
  private skipNextRefresh = false;
  private fieldMessages = new Map<string, HTMLDivElement>();
  private fieldControls = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
  private saveStatusEl: HTMLSpanElement | null = null;
  private saveButtonEl: HTMLButtonElement | null = null;
  private projectButtonEl: HTMLButtonElement | null = null;
  private projectProgressEl: HTMLDivElement | null = null;
  private saveSpinnerTimeout: number | null = null;
  private projectProgressTimeout: number | null = null;
  private hasSubmitted = false;
  private saveStatus: "idle" | "saving" | "saved" | "error" = "idle";

  constructor(
    leaf: WorkspaceLeaf,
    private sessionManager: SessionManager,
    private vaultIndexer: VaultIndexer,
    private settings: LineageSettings
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_SESSION;
  }

  getDisplayText(): string {
    return "Lineage Session";
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("lineage-session-view");
    this.renderPlaceholder();

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.scheduleActiveFileLoad();
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (this.currentFile && file?.path === this.currentFile.path) {
          this.scheduleMetadataRefresh();
        }
      })
    );

    this.registerDomEvent(this.contentEl, "keydown", (event: KeyboardEvent) => {
      void this.handleKeydown(event);
    });

    await this.loadFromActiveFile();
  }

  async onClose(): Promise<void> {
    this.currentFile = null;
    this.currentSession = null;
    this.fieldMessages.clear();
    this.fieldControls.clear();
    this.saveButtonEl = null;
    this.projectButtonEl = null;
    this.projectProgressEl = null;
    this.saveStatusEl = null;
    this.clearTimeouts();
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    if (state && typeof state === "object" && "filePath" in state) {
      const filePath = (state as { filePath?: string }).filePath;
      if (filePath) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          await this.loadSession(file);
        }
      }
    }

    await super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return {
      filePath: this.currentFile?.path,
      ...super.getState()
    };
  }

  private scheduleActiveFileLoad(delay = 150): void {
    if (this.activeLeafTimeout) {
      window.clearTimeout(this.activeLeafTimeout);
    }

    this.activeLeafTimeout = window.setTimeout(() => {
      void this.loadFromActiveFile();
    }, delay);
  }

  private scheduleMetadataRefresh(delay = 300): void {
    if (this.metadataTimeout) {
      window.clearTimeout(this.metadataTimeout);
    }

    this.metadataTimeout = window.setTimeout(() => {
      if (this.skipNextRefresh) {
        this.skipNextRefresh = false;
        return;
      }
      if (this.currentFile) {
        void this.loadSession(this.currentFile);
      }
    }, delay);
  }

  private async loadFromActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      this.renderPlaceholder();
      this.currentFile = null;
      return;
    }

    await this.loadSession(file);
  }

  private async loadSession(file: TFile): Promise<void> {
    try {
      const startFile = file;
      const content = await this.app.vault.read(file);

      if (startFile !== this.app.workspace.getActiveFile()) {
        return;
      }

      const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---/.test(content);
      const hasSessionBlock = /```lineage-session[ \t]*\r?\n[\s\S]*?\r?\n```/.test(
        content
      );

      const isCandidate = hasFrontmatter && hasSessionBlock;

      if (!isCandidate) {
        this.renderPlaceholder();
        this.currentFile = null;
        this.currentSession = null;
        return;
      }

      const session = this.sessionManager.parseSession(content);

      this.currentFile = file;
      this.currentSession = session;
      this.renderSession(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("No YAML frontmatter found") ||
        message.includes("No lineage-session code block found")
      ) {
        this.renderPlaceholder();
        this.currentFile = null;
        this.currentSession = null;
        return;
      }
      console.error("Failed to load session:", error);
      new Notice(`Failed to load session: ${message}`);
      this.renderError(message);
    }
  }

  private renderSession(session: Session): void {
    const container = this.contentEl;
    container.empty();
    this.fieldMessages.clear();
    this.fieldControls.clear();
    this.hasSubmitted = false;

    const layout = document.createElement("div");
    layout.className = "session-layout";

    const content = document.createElement("div");
    content.className = "session-content";
    layout.appendChild(content);

    const fragment = document.createDocumentFragment();

    const header = document.createElement("div");
    header.className = "session-header";
    const title = document.createElement("h2");
    title.textContent = session.metadata.title || "Untitled session";
    header.appendChild(title);
    fragment.appendChild(header);

    const metadataSection = document.createElement("div");
    metadataSection.className = "session-metadata";
    const metadataTitle = document.createElement("h3");
    metadataTitle.textContent = "SOURCE METADATA";
    metadataSection.appendChild(metadataTitle);

    this.renderTextInput(metadataSection, {
      label: "Title",
      value: session.metadata.title,
      fieldKey: "metadata.title",
      required: true,
      onChange: (value) => {
        session.metadata.title = value;
        title.textContent = value || "Untitled session";
      }
    });

    this.renderSelectInput(metadataSection, {
      label: "Record type",
      value: session.metadata.record_type,
      fieldKey: "metadata.record_type",
      options: ["census", "vital", "church", "probate", "newspaper", "other"],
      onChange: (value) => {
        session.metadata.record_type = value as Session["metadata"]["record_type"];
      }
    });

    this.renderTextInput(metadataSection, {
      label: "Repository",
      value: session.metadata.repository,
      fieldKey: "metadata.repository",
      required: true,
      onChange: (value) => {
        session.metadata.repository = value;
      }
    });

    this.renderTextInput(metadataSection, {
      label: "Locator",
      value: session.metadata.locator,
      fieldKey: "metadata.locator",
      required: true,
      onChange: (value) => {
        session.metadata.locator = value;
      }
    });
    fragment.appendChild(metadataSection);

    const documentSection = document.createElement("div");
    documentSection.className = "session-document";
    const documentTitle = document.createElement("h3");
    documentTitle.textContent = "DOCUMENT";
    documentSection.appendChild(documentTitle);

    const documentMessage = this.createFieldMessage("document");
    documentSection.appendChild(documentMessage);

    const sessionDocument = session.session.session.document;
    this.renderTextInput(documentSection, {
      label: "URL",
      value: sessionDocument.url ?? "",
      fieldKey: "document.url",
      placeholder: "https://example.com/...",
      onChange: (value) => {
        sessionDocument.url = value;
      }
    });

    this.renderFileInput(documentSection, {
      label: "File (vault path)",
      value: sessionDocument.file ?? "",
      fieldKey: "document.file",
      onChange: (value) => {
        sessionDocument.file = value;
      },
      onPick: (file) => {
        sessionDocument.file = file.path;
      }
    });

    this.renderTextArea(documentSection, {
      label: "Transcription",
      value: sessionDocument.transcription ?? "",
      fieldKey: "document.transcription",
      placeholder: "Paste transcription text here…",
      onChange: (value) => {
        sessionDocument.transcription = value;
      }
    });
    fragment.appendChild(documentSection);

    const personsSection = document.createElement("div");
    personsSection.className = "session-persons";
    const personsTitle = document.createElement("h3");
    personsTitle.textContent = "PERSONS IN SESSION";
    personsSection.appendChild(personsTitle);
    this.renderPersons(personsSection, session);
    fragment.appendChild(personsSection);

    const assertionsSection = document.createElement("div");
    assertionsSection.className = "session-assertions";
    const assertionsTitle = document.createElement("h3");
    assertionsTitle.textContent = "ASSERTIONS";
    assertionsSection.appendChild(assertionsTitle);
    this.renderAssertions(assertionsSection, session);
    fragment.appendChild(assertionsSection);

    const actionsSection = document.createElement("div");
    actionsSection.className = "session-actions";
    this.renderActions(actionsSection);
    content.appendChild(fragment);
    layout.appendChild(actionsSection);
    container.appendChild(layout);

    this.validateSessionFields(session, "silent");
  }

  private renderTextInput(
    container: HTMLElement,
    options: {
      label: string;
      value: string;
      fieldKey: string;
      required?: boolean;
      placeholder?: string;
      onChange: (value: string) => void;
    }
  ): HTMLInputElement {
    const field = document.createElement("div");
    field.className = "session-input";

    const label = document.createElement("label");
    label.className = "session-input-label";
    label.textContent = options.label;
    if (options.required) {
      const required = document.createElement("span");
      required.className = "session-input-required";
      required.textContent = " *";
      label.appendChild(required);
    }
    field.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.value = options.value;
    if (options.placeholder) {
      input.placeholder = options.placeholder;
    }
    input.addEventListener("input", () => {
      options.onChange(input.value);
      this.scheduleSave();
    });
    input.addEventListener("blur", () => {
      this.validateSessionFields(this.currentSession, "blur", options.fieldKey);
      this.scheduleSave();
    });
    field.appendChild(input);

    const message = this.createFieldMessage(options.fieldKey);
    field.appendChild(message);
    this.fieldControls.set(options.fieldKey, input);

    container.appendChild(field);
    return input;
  }

  private renderSelectInput(
    container: HTMLElement,
    options: {
      label: string;
      value: string;
      fieldKey: string;
      options: string[];
      onChange: (value: string) => void;
    }
  ): HTMLSelectElement {
    const field = document.createElement("div");
    field.className = "session-input";

    const label = document.createElement("label");
    label.className = "session-input-label";
    label.textContent = options.label;
    field.appendChild(label);

    const select = document.createElement("select");
    options.options.forEach((option) => {
      const optionEl = document.createElement("option");
      optionEl.value = option;
      optionEl.textContent = option;
      if (option === options.value) {
        optionEl.selected = true;
      }
      select.appendChild(optionEl);
    });

    select.addEventListener("change", () => {
      options.onChange(select.value);
      this.validateSessionFields(this.currentSession, "blur", options.fieldKey);
      this.scheduleSave();
    });
    field.appendChild(select);

    const message = this.createFieldMessage(options.fieldKey);
    field.appendChild(message);
    this.fieldControls.set(options.fieldKey, select);

    container.appendChild(field);
    return select;
  }

  private renderFileInput(
    container: HTMLElement,
    options: {
      label: string;
      value: string;
      fieldKey: string;
      onChange: (value: string) => void;
      onPick: (file: TFile) => void;
    }
  ): HTMLInputElement {
    const field = document.createElement("div");
    field.className = "session-input";

    const label = document.createElement("label");
    label.className = "session-input-label";
    label.textContent = options.label;
    field.appendChild(label);

    const row = document.createElement("div");
    row.className = "session-input-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = options.value;
    input.placeholder = "Path in vault (e.g., Sources/1900-census.png)";
    input.addEventListener("input", () => {
      options.onChange(input.value);
      this.scheduleSave();
    });
    input.addEventListener("blur", () => {
      this.validateSessionFields(this.currentSession, "blur", options.fieldKey);
      this.scheduleSave();
    });
    row.appendChild(input);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "session-button";
    button.textContent = "Browse";
    button.addEventListener("click", () => {
      const modal = new VaultFileSuggestModal(this.app, (file) => {
        input.value = file.path;
        options.onPick(file);
        this.validateSessionFields(this.currentSession, "blur", options.fieldKey);
        this.scheduleSave();
      });
      modal.open();
    });
    row.appendChild(button);
    field.appendChild(row);

    const message = this.createFieldMessage(options.fieldKey);
    field.appendChild(message);
    this.fieldControls.set(options.fieldKey, input);

    container.appendChild(field);
    return input;
  }

  private renderTextArea(
    container: HTMLElement,
    options: {
      label: string;
      value: string;
      fieldKey: string;
      placeholder?: string;
      onChange: (value: string) => void;
    }
  ): HTMLTextAreaElement {
    const field = document.createElement("div");
    field.className = "session-input";

    const label = document.createElement("label");
    label.className = "session-input-label";
    label.textContent = options.label;
    field.appendChild(label);

    const textarea = document.createElement("textarea");
    textarea.value = options.value;
    if (options.placeholder) {
      textarea.placeholder = options.placeholder;
    }
    textarea.addEventListener("input", () => {
      options.onChange(textarea.value);
      this.scheduleSave();
    });
    textarea.addEventListener("blur", () => {
      this.validateSessionFields(this.currentSession, "blur", options.fieldKey);
      this.scheduleSave();
    });
    field.appendChild(textarea);

    const message = this.createFieldMessage(options.fieldKey);
    field.appendChild(message);
    this.fieldControls.set(options.fieldKey, textarea);

    container.appendChild(field);
    return textarea;
  }

  private renderPersons(container: HTMLElement, session: Session): void {
    const list = document.createElement("div");
    list.className = "session-person-list";

    if (session.session.persons.length === 0) {
      const empty = document.createElement("p");
      empty.className = "session-empty";
      empty.textContent = "No persons yet.";
      list.appendChild(empty);
    } else {
      session.session.persons.forEach((person) => {
        const row = document.createElement("div");
        row.className = "session-person-row";

        const name = document.createElement("span");
        name.className = "session-person-name";
        name.textContent = person.name?.trim() || "Unnamed person";
        row.appendChild(name);

        const meta = document.createElement("span");
        meta.className = "session-person-meta";
        meta.textContent = person.sex ? `(${person.sex})` : "";
        row.appendChild(meta);

        const status = document.createElement("span");
        status.className = "session-person-status";
        if (person.matched_to) {
          status.textContent = "✓ matched";
          status.title = `Matched to ${person.matched_to}`;
        } else {
          status.textContent = "⚠ unmatched";
        }
        row.appendChild(status);

        const actions = document.createElement("div");
        actions.className = "session-row-actions";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "session-button is-danger";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", () => {
          const confirmed = window.confirm(
            `Remove ${person.name ?? "this person"} from the session?`
          );
          if (!confirmed) {
            return;
          }
          this.removePerson(person.id);
        });
        actions.appendChild(removeButton);

        row.appendChild(actions);
        list.appendChild(row);
      });
    }

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "session-button";
    addButton.textContent = "Add person";
    addButton.addEventListener("click", () => {
      if (!this.currentSession) {
        return;
      }
      const modal = new AddPersonModal(this.app, (data) => {
        const person: Person = {
          id: this.nextPersonId(this.currentSession!.session.persons),
          name: data.name,
          sex: data.sex,
          matched_to: null
        };
        this.currentSession!.session.persons.push(person);
        this.renderSession(this.currentSession!);
        this.scheduleIdleSave();
        this.openMatchModal(person);
      });
      modal.open();
    });

    container.appendChild(list);
    container.appendChild(addButton);
  }

  private renderAssertions(container: HTMLElement, session: Session): void {
    const assertions = session.session.assertions;
    const personsById = new Map(
      session.session.persons.map((person) => [person.id, person])
    );
    if (assertions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "session-empty";
      empty.textContent = "No assertions yet.";
      container.appendChild(empty);
    } else {
      const grouped = this.groupAssertionsByType(assertions);
      for (const [type, entries] of grouped) {
        const group = document.createElement("div");
        group.className = "session-assertion-group";

        const title = document.createElement("h4");
        title.textContent = type;
        group.appendChild(title);

        entries.forEach((assertion) => {
          const details = document.createElement("details");
          details.className = "session-assertion";

          const summary = document.createElement("summary");

          const participantNames = this.getParticipantNames(assertion, personsById);
          const label = document.createElement("span");
          label.textContent = this.describeAssertion(assertion, participantNames);
          summary.appendChild(label);

          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "session-button is-danger is-inline";
          deleteButton.textContent = "Delete";
          deleteButton.addEventListener("click", (event) => {
            event.preventDefault();
            const confirmed = window.confirm("Delete this assertion?");
            if (!confirmed) {
              return;
            }
            this.deleteAssertion(assertion.id);
          });
          summary.appendChild(deleteButton);

          details.appendChild(summary);

          const body = document.createElement("div");
          body.className = "session-assertion-body";

          const isParentChild = assertion.type === "parent-child";
          const missingParentChild =
            isParentChild && (!assertion.parent_ref || !assertion.child_ref);

          if (missingParentChild) {
            const warning = document.createElement("p");
            warning.className = "session-warning";
            warning.textContent = "This assertion requires both a parent and a child.";
            body.appendChild(warning);
          } else if (!isParentChild && participantNames.length === 0) {
            const warning = document.createElement("p");
            warning.className = "session-warning";
            warning.textContent =
              "This assertion has no participants. Review or delete it.";
            body.appendChild(warning);
          }

          if (assertion.parent_ref) {
            const parentName =
              personsById.get(assertion.parent_ref)?.name || assertion.parent_ref;
            body.appendChild(this.renderAssertionField("Parent", parentName));
          }
          if (assertion.child_ref) {
            const childName =
              personsById.get(assertion.child_ref)?.name || assertion.child_ref;
            body.appendChild(this.renderAssertionField("Child", childName));
          }
          if (assertion.date) {
            body.appendChild(this.renderAssertionField("Date", String(assertion.date)));
          }
          if (assertion.place) {
            body.appendChild(this.renderAssertionField("Place", String(assertion.place)));
          }
          if (assertion.statement) {
            body.appendChild(
              this.renderAssertionField("Statement", String(assertion.statement))
            );
          }
          if (assertion.name) {
            body.appendChild(this.renderAssertionField("Name", String(assertion.name)));
          }
          if (assertion.sex) {
            body.appendChild(this.renderAssertionField("Sex", String(assertion.sex)));
          }

          details.appendChild(body);
          group.appendChild(details);
        });

        container.appendChild(group);
      }
    }

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "session-button";
    addButton.textContent = "Add assertion";
    addButton.addEventListener("click", () => {
      this.openAddAssertionModal();
    });

    container.appendChild(addButton);
  }

  private renderActions(container: HTMLElement): void {
    const row = document.createElement("div");
    row.className = "session-actions-row";

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "session-button is-primary";
    saveButton.textContent = "Save session";
    saveButton.addEventListener("click", () => {
      void this.saveSession({ trigger: "manual" });
    });
    row.appendChild(saveButton);
    this.saveButtonEl = saveButton;

    const projectButton = document.createElement("button");
    projectButton.type = "button";
    projectButton.className = "session-button";
    projectButton.textContent = "Project to Entities";
    projectButton.addEventListener("click", () => {
      void this.projectSession();
    });
    row.appendChild(projectButton);
    this.projectButtonEl = projectButton;

    const status = document.createElement("span");
    status.className = "session-save-status";
    row.appendChild(status);
    this.saveStatusEl = status;
    this.updateSaveStatus(this.saveStatus);

    const progress = document.createElement("div");
    progress.className = "session-project-progress is-hidden";
    const progressBar = document.createElement("div");
    progressBar.className = "session-project-progress-bar";
    progress.appendChild(progressBar);
    this.projectProgressEl = progress;

    container.appendChild(row);
    container.appendChild(progress);
  }

  private async projectSession(
    options: {
      skipValidation?: boolean;
    } = {}
  ): Promise<void> {
    if (!this.currentSession || !this.currentFile) {
      new Notice("No active session loaded.");
      return;
    }

    if (!options.skipValidation) {
      const valid = this.refreshValidation("submit");
      if (!valid) {
        new Notice("Fix session errors before projecting.");
        return;
      }
    }

    this.startProjectionLoading();

    try {
      const engine = new ProjectionEngine({
        app: this.app,
        settings: this.settings,
        vaultIndexer: this.vaultIndexer
      });
      const summary = await engine.projectSession(this.currentSession, this.currentFile);
      const modal = new ProjectionSummaryModal(this.app, summary, {
        onRetry: () => {
          void this.projectSession();
        }
      });
      modal.open();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const summary = {
        ...createEmptySummary(),
        errors: [`Projection failed: ${message}`]
      };
      const modal = new ProjectionSummaryModal(this.app, summary, {
        onRetry: () => {
          void this.projectSession();
        }
      });
      modal.open();
    } finally {
      this.stopProjectionLoading();
    }
  }

  private startProjectionLoading(): void {
    this.projectButtonEl?.classList.add("is-loading");
    if (this.projectProgressTimeout) {
      window.clearTimeout(this.projectProgressTimeout);
    }
    this.projectProgressTimeout = window.setTimeout(() => {
      this.projectProgressEl?.classList.remove("is-hidden");
    }, 350);
  }

  private stopProjectionLoading(): void {
    this.projectButtonEl?.classList.remove("is-loading");
    if (this.projectProgressTimeout) {
      window.clearTimeout(this.projectProgressTimeout);
      this.projectProgressTimeout = null;
    }
    this.projectProgressEl?.classList.add("is-hidden");
  }

  private async handleKeydown(event: KeyboardEvent): Promise<void> {
    const hasModifier = event.metaKey || event.ctrlKey;
    if (!hasModifier || event.altKey || event.shiftKey) {
      return;
    }
    const key = event.key.toLowerCase();

    if (key === "n") {
      event.preventDefault();
      event.stopPropagation();
      this.openAddAssertionModal();
      return;
    }

    if (key !== "enter") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const valid = await this.saveSession({ trigger: "manual" });
    if (valid) {
      await this.projectSession({ skipValidation: true });
    }
  }

  private openAddAssertionModal(): void {
    if (!this.currentSession) {
      new Notice("No active session loaded.");
      return;
    }

    const modal = new AddAssertionModal(
      this.app,
      this.currentSession.session.persons,
      this.vaultIndexer,
      (result) => {
        this.addAssertion(result);
      }
    );
    modal.open();
  }

  private setSaveLoading(isLoading: boolean): void {
    this.saveButtonEl?.classList.toggle("is-loading", isLoading);
  }

  private startSaveLoading(): void {
    if (this.saveSpinnerTimeout) {
      window.clearTimeout(this.saveSpinnerTimeout);
    }
    this.saveSpinnerTimeout = window.setTimeout(() => {
      this.setSaveLoading(true);
    }, 250);
  }

  private stopSaveLoading(): void {
    if (this.saveSpinnerTimeout) {
      window.clearTimeout(this.saveSpinnerTimeout);
      this.saveSpinnerTimeout = null;
    }
    this.setSaveLoading(false);
  }

  private async persistSession(): Promise<void> {
    if (!this.currentFile || !this.currentSession) {
      return;
    }

    const updates = this.currentSession;
    this.startSaveLoading();
    try {
      this.updateSaveStatus("saving");
      this.skipNextRefresh = true;
      await this.app.vault.process(this.currentFile, (content) => {
        const session = this.sessionManager.parseSession(content);
        session.metadata.title = updates.metadata.title;
        session.metadata.record_type = updates.metadata.record_type;
        session.metadata.repository = updates.metadata.repository;
        session.metadata.locator = updates.metadata.locator;
        session.session.session.document = {
          url: updates.session.session.document.url ?? "",
          file: updates.session.session.document.file ?? "",
          transcription: updates.session.session.document.transcription ?? ""
        };
        session.session.persons = updates.session.persons;
        session.session.assertions = updates.session.assertions;
        session.session.citations = updates.session.citations;
        session.session.sources = updates.session.sources;
        return this.sessionManager.serializeSession(session);
      });
      this.updateSaveStatus("saved");
    } catch (error) {
      this.skipNextRefresh = false;
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to save session:", error);
      new Notice(`Failed to save session: ${message}`);
      this.updateSaveStatus("error");
      throw error;
    } finally {
      this.stopSaveLoading();
    }
  }

  private renderAssertionField(label: string, value: string): HTMLElement {
    const row = document.createElement("div");
    row.className = "session-assertion-field";

    const labelEl = document.createElement("span");
    labelEl.className = "session-assertion-label";
    labelEl.textContent = `${label}:`;
    row.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    row.appendChild(valueEl);

    return row;
  }

  private groupAssertionsByType(assertions: Assertion[]): Map<string, Assertion[]> {
    const grouped = new Map<string, Assertion[]>();
    assertions.forEach((assertion) => {
      const type = assertion.type || "Other";
      const list = grouped.get(type) ?? [];
      list.push(assertion);
      grouped.set(type, list);
    });
    return grouped;
  }

  private getParticipantNames(
    assertion: Assertion,
    personsById: Map<string, Person>
  ): string[] {
    if (assertion.type === "parent-child") {
      const parentName = assertion.parent_ref
        ? personsById.get(assertion.parent_ref)?.name || ""
        : "";
      const childName = assertion.child_ref
        ? personsById.get(assertion.child_ref)?.name || ""
        : "";
      return [parentName, childName].filter(Boolean);
    }
    if (!assertion.participants || assertion.participants.length === 0) {
      return [];
    }
    return assertion.participants
      .map((participant) => personsById.get(participant.person_ref)?.name || "")
      .filter(Boolean);
  }

  private describeAssertion(assertion: Assertion, participantNames: string[]): string {
    if (assertion.type === "parent-child") {
      const parentLabel = participantNames[0] ?? "Parent?";
      const childLabel = participantNames[1] ?? "Child?";
      return `${assertion.type} — ${parentLabel} → ${childLabel}`;
    }

    const participantsLabel =
      participantNames.length > 0 ? participantNames.join(", ") : "No participants";
    return `${assertion.type} — ${participantsLabel}`;
  }

  private createFieldMessage(fieldKey: string): HTMLDivElement {
    const message = document.createElement("div");
    message.className = "session-field-message is-empty";
    message.setAttribute("aria-live", "polite");
    this.fieldMessages.set(fieldKey, message);
    return message;
  }

  private removePerson(personId: string): void {
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    session.session.persons = session.session.persons.filter(
      (person) => person.id !== personId
    );

    session.session.assertions.forEach((assertion) => {
      if (!assertion.participants) {
        // no-op
      } else {
        assertion.participants = assertion.participants.filter(
          (participant) => participant.person_ref !== personId
        );
      }
      if (assertion.parent_ref === personId) {
        assertion.parent_ref = undefined;
      }
      if (assertion.child_ref === personId) {
        assertion.child_ref = undefined;
      }
    });

    this.renderSession(session);
    this.scheduleSave();
  }

  private addAssertion(result: AddAssertionResult): void {
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    const citationId =
      result.citationSnippet || result.citationLocator
        ? this.nextCitationId(session.session.citations)
        : undefined;
    const assertion: Assertion = {
      id: this.nextAssertionId(session.session.assertions),
      type: result.type,
      participants: result.participants
        ? result.participants.map((personRef) => ({ person_ref: personRef }))
        : undefined,
      parent_ref: result.parentRef,
      child_ref: result.childRef,
      date: result.date || undefined,
      place: result.place || undefined,
      statement: result.statement || undefined,
      name: result.name || undefined,
      sex: result.sex || undefined,
      citations: citationId ? [citationId] : undefined
    };

    session.session.assertions.push(assertion);

    if (citationId) {
      session.session.citations.push({
        id: citationId,
        source_id: result.sourceId,
        snippet: result.citationSnippet || undefined,
        locator: result.citationLocator || undefined
      });
    }

    this.renderSession(session);
    this.scheduleIdleSave();
  }

  private deleteAssertion(assertionId: string): void {
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    session.session.assertions = session.session.assertions.filter(
      (assertion) => assertion.id !== assertionId
    );

    this.renderSession(session);
    this.scheduleIdleSave();
  }

  private nextPersonId(persons: Person[]): string {
    const ids = persons
      .map((person) => parseInt(person.id.replace(/^p/, ""), 10))
      .filter((value) => !Number.isNaN(value));
    const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    return `p${next}`;
  }

  private nextAssertionId(assertions: Assertion[]): string {
    const ids = assertions
      .map((assertion) => parseInt(assertion.id.replace(/^a/, ""), 10))
      .filter((value) => !Number.isNaN(value));
    const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    return `a${next}`;
  }

  private nextCitationId(citations: { id: string }[]): string {
    const ids = citations
      .map((citation) => parseInt(citation.id.replace(/^c/, ""), 10))
      .filter((value) => !Number.isNaN(value));
    const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
    return `c${next}`;
  }

  private openMatchModal(person: Person): void {
    const candidates = this.buildMatchCandidates(person);
    const modal = new MatchModal(this.app, person, candidates, (match) => {
      person.matched_to = match ?? null;
      this.renderSession(this.currentSession!);
      this.scheduleIdleSave();
    });
    modal.open();
  }

  private buildMatchCandidates(person: Person): MatchCandidateView[] {
    const entries = this.vaultIndexer.getPersonEntries();
    if (!person.name?.trim()) {
      return [];
    }

    const candidates = entries.map((entry) => {
      const nameScore = scoreName(person.name ?? "", entry.name);
      const features = {
        name: nameScore,
        date: 0.5,
        place: 0,
        relationship: 0
      };
      const score = computeCompositeScore(features);
      return {
        id: entry.file.path,
        name: entry.name,
        filePath: entry.file.path,
        nameScore,
        dateScore: features.date,
        placeScore: features.place,
        score
      };
    });

    return candidates
      .filter((candidate) => candidate.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private scheduleIdleSave(delay = 30_000): void {
    if (this.idleSaveTimeout) {
      window.clearTimeout(this.idleSaveTimeout);
    }

    this.idleSaveTimeout = window.setTimeout(() => {
      void this.saveSession({ trigger: "auto" });
    }, delay);
  }

  private updateSaveStatus(status: "idle" | "saving" | "saved" | "error"): void {
    this.saveStatus = status;
    if (!this.saveStatusEl) {
      return;
    }

    const textMap: Record<typeof status, string> = {
      idle: "",
      saving: "Saving…",
      saved: "Saved ✓",
      error: "Error ⚠"
    };
    this.saveStatusEl.textContent = textMap[status];
  }

  private refreshValidation(
    mode: "silent" | "blur" | "submit" = "silent",
    fieldKey?: string
  ): boolean {
    return this.validateSessionFields(this.currentSession, mode, fieldKey);
  }

  private validateSessionFields(
    session: Session | null,
    mode: "silent" | "blur" | "submit",
    fieldKey?: string
  ): boolean {
    if (!session) {
      return false;
    }

    type ValidationIssue = {
      fieldKey: string;
      text: string;
      level: "error" | "warning";
      kind: "required" | "format" | "conditional";
    };

    const issues: ValidationIssue[] = [];
    const document = session.session.session.document;

    if (!session.metadata.title.trim()) {
      issues.push({
        fieldKey: "metadata.title",
        text: "Title is required.",
        level: "error",
        kind: "required"
      });
    }

    if (!session.metadata.record_type?.trim()) {
      issues.push({
        fieldKey: "metadata.record_type",
        text: "Record type is required.",
        level: "error",
        kind: "required"
      });
    }

    if (!session.metadata.repository.trim()) {
      issues.push({
        fieldKey: "metadata.repository",
        text: "Repository is required.",
        level: "error",
        kind: "required"
      });
    }

    if (!session.metadata.locator.trim()) {
      issues.push({
        fieldKey: "metadata.locator",
        text: "Locator is required.",
        level: "error",
        kind: "required"
      });
    }

    const hasCapture =
      Boolean(document.url?.trim()) ||
      Boolean(document.file?.trim()) ||
      Boolean(document.transcription?.trim());
    if (!hasCapture) {
      issues.push({
        fieldKey: "document",
        text: "Provide a URL, file, or transcription to save the document.",
        level: "error",
        kind: "conditional"
      });
    }

    const filePath = document.file?.trim() ?? "";
    if (filePath) {
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) {
        issues.push({
          fieldKey: "document.file",
          text: "File not found in the vault.",
          level: "error",
          kind: "format"
        });
      }
    }

    const url = document.url?.trim() ?? "";
    if (url && !this.isValidUrl(url)) {
      issues.push({
        fieldKey: "document.url",
        text: "Invalid URL format.",
        level: "error",
        kind: "format"
      });
    }

    const hasBlockingErrors = issues.some((issue) => issue.level === "error");
    if (mode === "silent") {
      return !hasBlockingErrors;
    }

    if (mode === "submit") {
      this.hasSubmitted = true;
    }

    const showAll = mode === "submit" || this.hasSubmitted;
    if (!showAll && mode === "blur" && fieldKey) {
      this.clearFieldMessage(fieldKey);
      const fieldIssue = issues.find(
        (issue) => issue.kind === "format" && issue.fieldKey === fieldKey
      );
      if (fieldIssue) {
        this.setFieldMessage(fieldIssue.fieldKey, fieldIssue.text, fieldIssue.level);
      }
      return !hasBlockingErrors;
    }

    this.clearFieldMessages();

    for (const issue of issues) {
      const shouldShow =
        showAll ||
        (mode === "blur" &&
          issue.kind === "format" &&
          fieldKey &&
          issue.fieldKey === fieldKey);
      if (!shouldShow) {
        continue;
      }
      this.setFieldMessage(issue.fieldKey, issue.text, issue.level);
    }

    return !hasBlockingErrors;
  }

  private clearFieldMessage(fieldKey: string): void {
    const message = this.fieldMessages.get(fieldKey);
    if (message) {
      message.textContent = "";
      message.classList.add("is-empty");
      message.classList.remove("is-warning");
    }

    const control = this.fieldControls.get(fieldKey);
    if (control) {
      control.classList.remove("is-invalid");
      control.setAttribute("aria-invalid", "false");
    }
  }

  private clearFieldMessages(): void {
    for (const message of this.fieldMessages.values()) {
      message.textContent = "";
      message.classList.add("is-empty");
      message.classList.remove("is-warning");
    }

    for (const control of this.fieldControls.values()) {
      control.classList.remove("is-invalid");
      control.setAttribute("aria-invalid", "false");
    }
  }

  private setFieldMessage(
    fieldKey: string,
    text: string,
    level: "error" | "warning" = "error"
  ): void {
    const message = this.fieldMessages.get(fieldKey);
    if (!message) {
      return;
    }
    message.textContent = text;
    message.classList.remove("is-empty");
    if (level === "warning") {
      message.classList.add("is-warning");
    } else {
      message.classList.remove("is-warning");
    }

    const control = this.fieldControls.get(fieldKey);
    if (control) {
      const isInvalid = level === "error";
      control.classList.toggle("is-invalid", isInvalid);
      control.setAttribute("aria-invalid", isInvalid ? "true" : "false");
    }
  }

  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private scheduleSave(delay = 400): void {
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = window.setTimeout(() => {
      void this.saveSession({ trigger: "auto" });
    }, delay);
  }

  private async saveSession(
    options: {
      trigger: "auto" | "manual";
    }
  ): Promise<boolean> {
    if (!this.currentFile || !this.currentSession) {
      return false;
    }

    const isManual = options.trigger === "manual";
    const isValid = this.refreshValidation(isManual ? "submit" : "silent");
    if (!isValid) {
      if (isManual) {
        this.updateSaveStatus("error");
      }
      return false;
    }

    try {
      await this.persistSession();
      return true;
    } catch (error) {
      return false;
    }
  }

  private clearTimeouts(): void {
    if (this.activeLeafTimeout) {
      window.clearTimeout(this.activeLeafTimeout);
      this.activeLeafTimeout = null;
    }
    if (this.metadataTimeout) {
      window.clearTimeout(this.metadataTimeout);
      this.metadataTimeout = null;
    }
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.idleSaveTimeout) {
      window.clearTimeout(this.idleSaveTimeout);
      this.idleSaveTimeout = null;
    }
    if (this.saveSpinnerTimeout) {
      window.clearTimeout(this.saveSpinnerTimeout);
      this.saveSpinnerTimeout = null;
    }
    if (this.projectProgressTimeout) {
      window.clearTimeout(this.projectProgressTimeout);
      this.projectProgressTimeout = null;
    }
  }

  private renderPlaceholder(): void {
    const container = this.contentEl;
    container.empty();
    this.saveButtonEl = null;
    this.projectButtonEl = null;
    this.projectProgressEl = null;
    this.saveStatusEl = null;
    this.hasSubmitted = false;

    const placeholder = document.createElement("div");
    placeholder.className = "session-placeholder";

    const title = document.createElement("p");
    title.textContent = "No research session loaded";
    placeholder.appendChild(title);

    const hint = document.createElement("p");
    hint.className = "session-placeholder-hint";
    hint.textContent = "Open a research session note to view details here";
    placeholder.appendChild(hint);

    container.appendChild(placeholder);
  }

  private renderError(message: string): void {
    const container = this.contentEl;
    container.empty();
    this.saveButtonEl = null;
    this.projectButtonEl = null;
    this.projectProgressEl = null;
    this.saveStatusEl = null;
    this.hasSubmitted = false;

    const error = document.createElement("div");
    error.className = "session-error";

    const title = document.createElement("h3");
    title.textContent = "Error Loading Session";
    error.appendChild(title);

    const description = document.createElement("p");
    description.textContent = message;
    error.appendChild(description);

    container.appendChild(error);
  }
}

class VaultFileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private onSelect: (file: TFile) => void) {
    super(app);
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles();
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onSelect(item);
  }
}

type MatchCandidateView = {
  id: string;
  name: string;
  filePath: string;
  score: number;
  nameScore: number;
  dateScore: number;
  placeScore: number;
};

type AddAssertionResult = {
  type: string;
  participants?: string[];
  parentRef?: string;
  childRef?: string;
  date?: string;
  place?: string;
  statement?: string;
  name?: string;
  sex?: string;
  citationSnippet?: string;
  citationLocator?: string;
  sourceId?: string;
};

class AddPersonModal extends Modal {
  private nameInput!: HTMLInputElement;
  private sexSelect!: HTMLSelectElement;
  private errorEl!: HTMLDivElement;

  constructor(app: App, private onSubmit: (data: { name: string; sex?: string }) => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("lineage-form-modal");
    this.titleEl.setText("Add person");
    this.contentEl.empty();

    const form = this.contentEl.createDiv({ cls: "session-modal" });

    const nameLabel = form.createEl("label", { text: "Name" });
    this.nameInput = form.createEl("input", { type: "text" });
    this.nameInput.placeholder = "Full name";
    nameLabel.appendChild(this.nameInput);

    const sexLabel = form.createEl("label", { text: "Sex" });
    this.sexSelect = form.createEl("select");
    ["", "M", "F", "U"].forEach((value) => {
      const option = this.sexSelect.createEl("option");
      option.value = value;
      option.textContent = value || "Unspecified";
      this.sexSelect.appendChild(option);
    });
    sexLabel.appendChild(this.sexSelect);

    this.errorEl = form.createDiv({ cls: "session-modal-error" });

    const actions = form.createDiv({ cls: "session-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const submit = actions.createEl("button", { text: "Add" });
    submit.addEventListener("click", () => {
      const name = this.nameInput.value.trim();
      if (!name) {
        this.errorEl.textContent = "Name is required.";
        return;
      }
      this.onSubmit({ name, sex: this.sexSelect.value || undefined });
      this.close();
    });
  }
}

class MatchModal extends Modal {
  private errorEl!: HTMLDivElement;

  constructor(
    app: App,
    private person: Person,
    private candidates: MatchCandidateView[],
    private onConfirm: (matchedTo: string | null) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Match person");
    this.contentEl.empty();

    const intro = this.contentEl.createEl("p");
    intro.textContent = `Match “${this.person.name}” to an existing person?`;

    const list = this.contentEl.createDiv({ cls: "session-modal-list" });

    const createRow = list.createDiv({ cls: "session-modal-row" });
    const createRadio = createRow.createEl("input", {
      type: "radio"
    });
    createRadio.name = "match-choice";
    createRadio.value = "create";
    createRadio.checked = true;
    createRadio.addEventListener("change", () => {
      this.errorEl.textContent = "";
    });
    createRow.createEl("span", { text: "Create new person (no match)" });

    if (this.candidates.length === 0) {
      const empty = list.createEl("p");
      empty.textContent = "No matches found.";
      empty.className = "session-empty";
    } else {
      this.candidates.forEach((candidate) => {
        const row = list.createDiv({ cls: "session-modal-row" });
        const radio = row.createEl("input", { type: "radio" });
        radio.name = "match-choice";
        radio.value = candidate.id;
        radio.addEventListener("change", () => {
          this.errorEl.textContent = "";
        });
        const label = row.createDiv({ cls: "session-modal-label" });
        label.createEl("strong", { text: candidate.name });
        label.createEl("span", {
          text: ` — ${formatPercent(candidate.score)}`
        });

        const breakdown = row.createEl("div", { cls: "session-modal-breakdown" });
        breakdown.textContent = `Name ${formatPercent(candidate.nameScore)}, Date ${formatPercent(candidate.dateScore)}, Place ${formatPercent(candidate.placeScore)}`;
      });
    }

    this.errorEl = this.contentEl.createDiv({ cls: "session-modal-error" });

    const actions = this.contentEl.createDiv({ cls: "session-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const confirm = actions.createEl("button", { text: "Confirm" });
    confirm.addEventListener("click", () => {
      const selected = this.contentEl.querySelector<HTMLInputElement>(
        'input[name="match-choice"]:checked'
      );
      if (!selected) {
        this.errorEl.textContent = "Select a match option.";
        return;
      }
      if (selected.value === "create") {
        this.onConfirm(null);
        this.close();
        return;
      }
      const candidate = this.candidates.find((item) => item.id === selected.value);
      if (!candidate) {
        this.errorEl.textContent = "Select a valid match.";
        return;
      }
      this.onConfirm(`[[${candidate.name}]]`);
      this.close();
    });
  }
}

class AddAssertionModal extends Modal {
  private typeSelect!: HTMLSelectElement;
  private participantInputs: HTMLInputElement[] = [];
  private participantSection!: HTMLLabelElement;
  private parentSelect!: HTMLSelectElement;
  private childSelect!: HTMLSelectElement;
  private parentChildSection!: HTMLDivElement;
  private dateInput!: HTMLInputElement;
  private placeInput!: HTMLInputElement;
  private statementInput!: HTMLTextAreaElement;
  private nameInput!: HTMLInputElement;
  private sexSelect!: HTMLSelectElement;
  private citationSnippetInput!: HTMLTextAreaElement;
  private citationLocatorInput!: HTMLInputElement;
  private errorEl!: HTMLDivElement;

  constructor(
    app: App,
    private persons: Person[],
    private vaultIndexer: VaultIndexer,
    private onSubmit: (result: AddAssertionResult) => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("lineage-form-modal");
    this.titleEl.setText("Add assertion");
    this.contentEl.empty();

    const form = this.contentEl.createDiv({ cls: "session-modal" });

    const typeLabel = form.createEl("label", { text: "Type" });
    this.typeSelect = form.createEl("select");
    [
      "identity",
      "birth",
      "death",
      "marriage",
      "parent-child",
      "residence",
      "freeform"
    ].forEach((value) => {
      const option = this.typeSelect.createEl("option");
      option.value = value;
      option.textContent = value;
      this.typeSelect.appendChild(option);
    });
    typeLabel.appendChild(this.typeSelect);

    this.participantSection = form.createEl("label", { text: "Participants" });
    const participantList = this.participantSection.createDiv({
      cls: "session-modal-participants"
    });
    this.participantInputs = [];
    this.persons.forEach((person) => {
      const row = participantList.createDiv({ cls: "session-modal-row" });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.value = person.id;
      row.createEl("span", { text: person.name ?? person.id });
      this.participantInputs.push(checkbox);
    });
    if (this.persons.length === 0) {
      participantList.createDiv({
        cls: "session-modal-empty",
        text: "No persons in this session yet."
      });
    }
    this.participantSection.appendChild(participantList);

    this.parentChildSection = form.createDiv({ cls: "session-modal-parent-child" });
    const parentLabel = this.parentChildSection.createEl("label", { text: "Parent" });
    this.parentSelect = parentLabel.createEl("select");
    const parentPlaceholder = this.parentSelect.createEl("option");
    parentPlaceholder.value = "";
    parentPlaceholder.textContent = "Select parent";
    this.persons.forEach((person) => {
      const option = this.parentSelect.createEl("option");
      option.value = person.id;
      option.textContent = person.name ?? person.id;
    });

    const childLabel = this.parentChildSection.createEl("label", { text: "Child" });
    this.childSelect = childLabel.createEl("select");
    const childPlaceholder = this.childSelect.createEl("option");
    childPlaceholder.value = "";
    childPlaceholder.textContent = "Select child";
    this.persons.forEach((person) => {
      const option = this.childSelect.createEl("option");
      option.value = person.id;
      option.textContent = person.name ?? person.id;
    });

    const dateLabel = form.createEl("label", { text: "Date" });
    this.dateInput = form.createEl("input", { type: "text" });
    this.dateInput.placeholder = "YYYY-MM-DD or ~1872";
    dateLabel.appendChild(this.dateInput);

    const placeLabel = form.createEl("label", { text: "Place" });
    this.placeInput = form.createEl("input", { type: "text" });
    this.placeInput.placeholder = "Place name";
    placeLabel.appendChild(this.placeInput);
    new PlaceInputSuggest(this.app, this.placeInput, this.vaultIndexer);

    const statementLabel = form.createEl("label", { text: "Statement" });
    this.statementInput = form.createEl("textarea");
    this.statementInput.placeholder = "Assertion statement";
    statementLabel.appendChild(this.statementInput);

    const nameLabel = form.createEl("label", { text: "Name (identity only)" });
    this.nameInput = form.createEl("input", { type: "text" });
    nameLabel.appendChild(this.nameInput);

    const sexLabel = form.createEl("label", { text: "Sex (identity only)" });
    this.sexSelect = form.createEl("select");
    ["", "M", "F", "U"].forEach((value) => {
      const option = this.sexSelect.createEl("option");
      option.value = value;
      option.textContent = value || "Unspecified";
      this.sexSelect.appendChild(option);
    });
    sexLabel.appendChild(this.sexSelect);

    const snippetLabel = form.createEl("label", { text: "Citation snippet" });
    this.citationSnippetInput = form.createEl("textarea");
    snippetLabel.appendChild(this.citationSnippetInput);

    const locatorLabel = form.createEl("label", { text: "Citation locator" });
    this.citationLocatorInput = form.createEl("input", { type: "text" });
    this.citationLocatorInput.placeholder = "Page, line, image index";
    locatorLabel.appendChild(this.citationLocatorInput);

    this.errorEl = form.createDiv({ cls: "session-modal-error" });

    const toggleTypeFields = () => {
      const isIdentity = this.typeSelect.value === "identity";
      const isParentChild = this.typeSelect.value === "parent-child";
      nameLabel.style.display = isIdentity ? "flex" : "none";
      sexLabel.style.display = isIdentity ? "flex" : "none";
      this.participantSection.toggleAttribute("hidden", isParentChild);
      this.parentChildSection.toggleAttribute("hidden", !isParentChild);
      this.participantSection.style.display = isParentChild ? "none" : "flex";
      this.parentChildSection.style.display = isParentChild ? "flex" : "none";
      this.errorEl.textContent = "";
    };
    toggleTypeFields();
    this.typeSelect.addEventListener("change", toggleTypeFields);

    const actions = form.createDiv({ cls: "session-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());

    const submit = actions.createEl("button", { text: "Add assertion" });
    submit.addEventListener("click", () => {
      const type = this.typeSelect.value;
      const participants = this.participantInputs
        .filter((input) => input.checked)
        .map((input) => input.value);
      const parentRef = this.parentSelect?.value || undefined;
      const childRef = this.childSelect?.value || undefined;
      const isParentChild = type === "parent-child";

      if (isParentChild) {
        if (!parentRef || !childRef) {
          this.errorEl.textContent = "Select both a parent and a child.";
          return;
        }
        if (parentRef === childRef) {
          this.errorEl.textContent = "Parent and child must be different people.";
          return;
        }
      } else if (participants.length === 0) {
        this.errorEl.textContent = "Select at least one participant.";
        return;
      }

      const result: AddAssertionResult = {
        type,
        participants: isParentChild ? undefined : participants,
        parentRef: isParentChild ? parentRef : undefined,
        childRef: isParentChild ? childRef : undefined,
        date: this.dateInput.value.trim(),
        place: this.placeInput.value.trim(),
        statement: this.statementInput.value.trim(),
        name: this.nameInput.value.trim(),
        sex: this.sexSelect.value || undefined,
        citationSnippet: this.citationSnippetInput.value.trim(),
        citationLocator: this.citationLocatorInput.value.trim()
      };

      this.onSubmit(result);
      this.close();
    });
  }
}

class PlaceInputSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private indexer: VaultIndexer
  ) {
    super(app, inputEl);
  }

  getSuggestions(query: string): string[] {
    return this.indexer
      .findPlacesByName(query)
      .map((file) => file.basename)
      .slice(0, 10);
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
    this.setValue(`[[${value}]]`);
    this.close();
  }
}

class ProjectionSummaryModal extends Modal {
  constructor(
    app: App,
    private summary: ProjectionSummary,
    private options?: {
      onRetry?: () => void;
    }
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Projection Summary");
    this.contentEl.empty();

    const container = this.contentEl.createDiv({ cls: "session-modal" });
    this.renderFileSection(container, "Created", this.summary.created);
    this.renderFileSection(container, "Updated", this.summary.updated);
    this.renderErrorSection(container, "Errors", this.summary.errors);

    const actions = container.createDiv({ cls: "session-modal-actions" });
    if (this.summary.errors.length > 0 && this.options?.onRetry) {
      const retry = actions.createEl("button", { text: "Retry projection" });
      retry.addEventListener("click", () => {
        this.close();
        this.options?.onRetry?.();
      });
    }
    const close = actions.createEl("button", { text: "Close" });
    close.addEventListener("click", () => this.close());
  }

  private renderFileSection(container: HTMLElement, title: string, paths: string[]): void {
    const section = container.createDiv({ cls: "session-modal-section" });
    section.createEl("h3", { text: title });

    if (paths.length === 0) {
      section.createEl("p", { text: "None." });
      return;
    }

    const list = section.createEl("ul");
    paths.forEach((path) => {
      const item = list.createEl("li");
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const linkText = this.app.fileManager?.generateMarkdownLink
          ? this.app.fileManager.generateMarkdownLink(file, "")
          : `[[${file.basename}]]`;
        const link = item.createEl("a", { text: linkText });
        link.href = "#";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          void this.app.workspace.getLeaf(false).openFile(file, { active: true });
          this.close();
        });
      } else {
        item.setText(path);
      }
    });
  }

  private renderErrorSection(container: HTMLElement, title: string, errors: string[]): void {
    const section = container.createDiv({ cls: "session-modal-section" });
    section.setAttribute("role", "alert");
    section.createEl("h3", { text: title });
    if (errors.length === 0) {
      section.createEl("p", { text: "None." });
      return;
    }
    const list = section.createEl("ul");
    errors.forEach((error) => {
      list.createEl("li", { text: error });
    });
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
