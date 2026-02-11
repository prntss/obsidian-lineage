import { App, CachedMetadata, EventRef, TFile } from "obsidian";

export type PersonIndexEntry = {
  file: TFile;
  name: string;
  normalizedName: string;
};

export type PlaceIndexEntry = {
  file: TFile;
  name: string;
  normalizedName: string;
  parent?: string;
  normalizedParent?: string;
};

type LineageType = "person" | "place";

export class VaultIndexer {
  private personIndex = new Map<string, PersonIndexEntry>();
  private placeIndex = new Map<string, PlaceIndexEntry>();

  constructor(private app: App) {}

  initialize(registerEvent: (ref: EventRef) => void): void {
    this.rebuild();

    registerEvent(
      this.app.metadataCache.on("resolve", (file) => {
        if (file instanceof TFile) {
          this.updateFile(file);
        }
      })
    );

    registerEvent(
      this.app.metadataCache.on("resolved", () => {
        this.rebuild();
      })
    );

    registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) {
          this.updateFile(file);
        }
      })
    );
    registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.updateFile(file);
        }
      })
    );
    registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.removeFile(file.path);
        }
      })
    );
    registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile) {
          this.removeFile(oldPath);
          this.updateFile(file);
        }
      })
    );
    registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (file instanceof TFile) {
          this.updateFile(file);
        }
      })
    );
  }

  rebuild(): void {
    this.personIndex.clear();
    this.placeIndex.clear();

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (file instanceof TFile) {
        this.updateFile(file);
      }
    }
  }

  findPersonByName(query: string): TFile[] {
    const normalized = normalizeKey(query);
    if (!normalized) {
      return [];
    }

    return Array.from(this.personIndex.values())
      .filter((entry) => entry.normalizedName.includes(normalized))
      .map((entry) => entry.file);
  }

  findPlacesByName(query: string): TFile[] {
    const normalized = normalizeKey(query);
    if (!normalized) {
      return [];
    }

    return Array.from(this.placeIndex.values())
      .filter((entry) => entry.normalizedName.includes(normalized))
      .map((entry) => entry.file);
  }

  findPlacesByParent(parent: string): TFile[] {
    const normalized = normalizeKey(parent);
    if (!normalized) {
      return [];
    }

    return Array.from(this.placeIndex.values())
      .filter((entry) => entry.normalizedParent === normalized)
      .map((entry) => entry.file);
  }

  getPersonEntries(): PersonIndexEntry[] {
    return Array.from(this.personIndex.values());
  }

  private updateFile(file: TFile): void {
    const cache = this.app.metadataCache.getFileCache(file);
    const lineageType = this.getLineageType(cache);

    if (lineageType === "person") {
      const entry = this.buildPersonEntry(file, cache);
      if (entry) {
        this.personIndex.set(file.path, entry);
      } else {
        this.personIndex.delete(file.path);
      }
      this.placeIndex.delete(file.path);
      return;
    }

    if (lineageType === "place") {
      const entry = this.buildPlaceEntry(file, cache);
      if (entry) {
        this.placeIndex.set(file.path, entry);
      } else {
        this.placeIndex.delete(file.path);
      }
      this.personIndex.delete(file.path);
      return;
    }

    this.personIndex.delete(file.path);
    this.placeIndex.delete(file.path);
  }

  private removeFile(path: string): void {
    this.personIndex.delete(path);
    this.placeIndex.delete(path);
  }

  private getLineageType(cache?: CachedMetadata | null): LineageType | null {
    const frontmatter = cache?.frontmatter;
    if (!frontmatter || typeof frontmatter.lineage_type !== "string") {
      return null;
    }

    const lineageType = frontmatter.lineage_type.toLowerCase();
    if (lineageType === "person") {
      return "person";
    }

    if (lineageType === "place") {
      return "place";
    }

    return null;
  }

  private buildPersonEntry(
    file: TFile,
    cache?: CachedMetadata | null
  ): PersonIndexEntry | null {
    const frontmatter = cache?.frontmatter;
    const name = frontmatter?.name;
    if (typeof name !== "string" || !name.trim()) {
      return null;
    }

    return {
      file,
      name,
      normalizedName: normalizeKey(name)
    };
  }

  private buildPlaceEntry(
    file: TFile,
    cache?: CachedMetadata | null
  ): PlaceIndexEntry | null {
    const frontmatter = cache?.frontmatter;
    const name = frontmatter?.name;
    if (typeof name !== "string" || !name.trim()) {
      return null;
    }

    const parent =
      typeof frontmatter?.parent_place === "string"
        ? frontmatter.parent_place
        : typeof frontmatter?.parent === "string"
          ? frontmatter.parent
          : undefined;

    return {
      file,
      name,
      normalizedName: normalizeKey(name),
      parent,
      normalizedParent: parent ? normalizeKey(parent) : undefined
    };
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}
