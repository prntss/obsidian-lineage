export class TFile {
  constructor(public path = "", public basename = "") {}
}

export class TFolder {
  constructor(public path = "") {}
}

export class App {
  vault = {
    getAbstractFileByPath: () => null,
    createFolder: async (path: string) => new TFolder(path),
    create: async (_path: string, _content: string) => new TFile()
  };
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

export class Notice {
  constructor(public message: string) {}
}

export class WorkspaceLeaf {}

export class PluginSettingTab {
  constructor(public app: App, public plugin: unknown) {}
  display(): void {}
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addText(cb: (text: { setPlaceholder: (value: string) => unknown; setValue: (value: string) => unknown; onChange: (handler: (value: string) => unknown) => unknown; }) => void): this {
    const text = {
      setPlaceholder: () => text,
      setValue: () => text,
      onChange: () => text
    };
    cb(text);
    return this;
  }
}

export class ItemView {
  contentEl: HTMLElement = {} as HTMLElement;
  constructor(public leaf: WorkspaceLeaf) {}
  getViewType(): string {
    return "";
  }
  getDisplayText(): string {
    return "";
  }
  async onOpen(): Promise<void> {}
  async onClose(): Promise<void> {}
  async setState(_state: unknown, _result: unknown): Promise<void> {}
  getState(): Record<string, unknown> {
    return {};
  }
}
