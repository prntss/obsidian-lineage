import { Plugin, WorkspaceLeaf } from "obsidian";
import { registerCommands } from "./commands";
import { SessionManager } from "./session-manager";
import { VaultIndexer } from "./vault-indexer";
import { LineageSettingTab, DEFAULT_SETTINGS, LineageSettings, normalizeBaseFolder } from "./settings";
import { ensureBaseFolders } from "./projection/helpers";
import { SessionView, VIEW_TYPE_SESSION } from "./views/session-view";

export default class LineagePlugin extends Plugin {
  sessionManager!: SessionManager;
  vaultIndexer!: VaultIndexer;
  settings!: LineageSettings;

  async onload(): Promise<void> {
    this.settings = await this.loadSettings();

    this.sessionManager = new SessionManager(this.app);
    this.vaultIndexer = new VaultIndexer(this.app);
    this.vaultIndexer.initialize((ref) => this.registerEvent(ref));

    this.registerView(
      VIEW_TYPE_SESSION,
      (leaf: WorkspaceLeaf) =>
        new SessionView(leaf, this.sessionManager, this.vaultIndexer, this.settings)
    );

    this.addSettingTab(new LineageSettingTab(this.app, this));

    registerCommands(this);
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SESSION);
  }

  async activateSessionView(): Promise<void> {
    const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION);
    if (existingLeaves.length > 0) {
      this.app.workspace.revealLeaf(existingLeaves[0]);
      return;
    }

    // Always create a dedicated side leaf for the Session panel so we don't
    // replace an open editor/source tab.
    const leaf = this.app.workspace.getRightLeaf(true);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_SESSION,
      active: true
    });

    this.app.workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<LineageSettings> {
    const data = await this.loadData();
    return { ...DEFAULT_SETTINGS, ...(data as Partial<LineageSettings>) };
  }

  async saveSettings(): Promise<void> {
    this.settings.baseFolder = normalizeBaseFolder(this.settings.baseFolder);
    await this.saveData(this.settings);
    await ensureBaseFolders(this.app, this.settings);
  }
}
