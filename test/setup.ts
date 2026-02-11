import { vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var app: unknown;
}

const appMock = {
  vault: {
    read: vi.fn(),
    modify: vi.fn(),
    create: vi.fn(),
    getAbstractFileByPath: vi.fn(),
    createFolder: vi.fn()
  },
  workspace: {
    getActiveFile: vi.fn(),
    on: vi.fn(),
    getActiveViewOfType: vi.fn(),
    getLeaf: vi.fn(),
    getRightLeaf: vi.fn(),
    getLeavesOfType: vi.fn(),
    revealLeaf: vi.fn()
  },
  metadataCache: {
    getFileCache: vi.fn(),
    on: vi.fn()
  }
};

globalThis.app = appMock;

export {};
