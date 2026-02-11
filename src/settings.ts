import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";

export type LineageSettings = {
  baseFolder: string;
};

export const DEFAULT_SETTINGS: LineageSettings = {
  baseFolder: "Lineage"
};

export function normalizeBaseFolder(value: string): string {
  const trimmed = value.trim();
  const normalized = normalizePath(trimmed || DEFAULT_SETTINGS.baseFolder);
  return normalized.replace(/^\//, "");
}

export async function ensureFolder(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing) {
    return;
  }
  await app.vault.createFolder(normalized);
}

export async function ensureEntityFolders(
  app: App,
  baseFolder: string,
  subfolders: string[]
): Promise<void> {
  await ensureFolder(app, baseFolder);
  for (const subfolder of subfolders) {
    await ensureFolder(app, normalizePath(`${baseFolder}/${subfolder}`));
  }
}

export class LineageSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: { settings: LineageSettings; saveSettings: () => Promise<void> }) {
    super(app, plugin as never);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Base folder")
      .setDesc("Base folder for generated Lineage entities.")
      .addText((text) => {
        text
          .setPlaceholder(DEFAULT_SETTINGS.baseFolder)
          .setValue(this.plugin.settings.baseFolder)
          .onChange(async (value) => {
            this.plugin.settings.baseFolder = normalizeBaseFolder(value);
            await this.plugin.saveSettings();
          });
      });
  }
}
