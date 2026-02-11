import yaml from "js-yaml";
import { App, TFile, TFolder } from "obsidian";
import { ProjectedEntityIndex, ProjectionState } from "../src/projection/types";

export type MockFileEntry = {
  file: TFile;
  content: string;
};

export type MockVault = {
  getAbstractFileByPath: (path: string) => TFile | TFolder | null;
  getMarkdownFiles: () => TFile[];
  createFolder: (path: string) => Promise<TFolder>;
  create: (path: string, content: string) => Promise<TFile>;
  modify: (file: TFile, content: string) => Promise<void>;
  process: (file: TFile, handler: (content: string) => string) => Promise<string>;
};

export function createMockApp(): {
  app: App;
  files: Map<string, MockFileEntry>;
  folders: Map<string, TFolder>;
} {
  const files = new Map<string, MockFileEntry>();
  const folders = new Map<string, TFolder>();

  const vault: MockVault = {
    getAbstractFileByPath: (path: string) => files.get(path)?.file ?? folders.get(path) ?? null,
    getMarkdownFiles: () => Array.from(files.values()).map((entry) => entry.file),
    createFolder: async (path: string) => {
      const folder = new TFolder(path);
      folders.set(path, folder);
      return folder;
    },
    create: async (path: string, content: string) => {
      const basename = path.split("/").pop() ?? path;
      const name = basename.replace(/\.md$/i, "");
      const file = new TFile(path, name);
      files.set(path, { file, content });
      return file;
    },
    modify: async (file: TFile, content: string) => {
      const entry = files.get(file.path);
      if (entry) {
        entry.content = content;
        return;
      }
      files.set(file.path, { file, content });
    },
    process: async (file: TFile, handler: (content: string) => string) => {
      const entry = files.get(file.path);
      const current = entry?.content ?? "";
      const next = handler(current);
      if (entry) {
        entry.content = next;
      } else {
        files.set(file.path, { file, content: next });
      }
      return next;
    }
  };

  const metadataCache = {
    getFileCache: (file: TFile) => {
      const entry = files.get(file.path);
      if (!entry) {
        return {} as { frontmatter?: Record<string, unknown> };
      }
      const match = entry.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) {
        return {} as { frontmatter?: Record<string, unknown> };
      }
      const frontmatter = (yaml.load(match[1]) as Record<string, unknown>) ?? {};
      return { frontmatter } as { frontmatter?: Record<string, unknown> };
    },
    getFirstLinkpathDest: (target: string) => {
      for (const { file } of files.values()) {
        if (file.basename === target || file.path.endsWith(`/${target}.md`) || file.path === target) {
          return file;
        }
      }
      return null;
    }
  };

  const app = {
    vault,
    metadataCache
  } as unknown as App;

  return { app, files, folders };
}

export function getFileContent(files: Map<string, MockFileEntry>, path: string): string {
  const entry = files.get(path);
  if (!entry) {
    throw new Error(`Missing file: ${path}`);
  }
  return entry.content;
}

export function readFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }
  return (yaml.load(match[1]) as Record<string, unknown>) ?? {};
}

export function createProjectionState(): ProjectionState {
  const projectedEntities: ProjectedEntityIndex = {
    entries: [],
    byLineageId: new Map()
  };
  return {
    personFiles: new Map(),
    assertionTargets: new Map(),
    projectedFiles: new Map(),
    projectedEntities
  };
}
