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
  workspace = {
    on: () => ({})
  };
  metadataCache = {
    on: () => ({})
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
  app: App;
  constructor(public leaf: WorkspaceLeaf) {
    this.app = ((globalThis as { app?: App }).app ?? new App()) as App;
  }
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
  registerEvent(_eventRef: unknown): void {}
  registerDomEvent(
    _el: HTMLElement,
    _type: string,
    _callback: (event: Event) => void
  ): void {}
}

export class Modal {
  modalEl: HTMLElement = {} as HTMLElement;
  contentEl: HTMLElement = {} as HTMLElement;
  titleEl = {
    setText: (_text: string) => {}
  };
  constructor(public app: App) {}
  open(): void {
    this.onOpen();
  }
  close(): void {
    this.onClose();
  }
  onOpen(): void {}
  onClose(): void {}
}

export class FuzzySuggestModal<T> extends Modal {
  getItems(): T[] {
    return [];
  }
  getItemText(_item: T): string {
    return "";
  }
  onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}

export class AbstractInputSuggest<T> {
  constructor(public app: App, public inputEl: HTMLInputElement) {}
  getSuggestions(_query: string): T[] {
    return [];
  }
  renderSuggestion(_value: T, _el: HTMLElement): void {}
  selectSuggestion(_value: T): void {}
  close(): void {}
}
