import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { VaultIndexer } from "../src/vault-indexer";

describe("VaultIndexer", () => {
  it("indexes persons by name", () => {
    const files = [new TFile("People/John.md", "John"), new TFile("People/Jane.md", "Jane")];
    const frontmatterByPath: Record<string, Record<string, unknown>> = {
      "People/John.md": { lineage_type: "person", name: "John O'Connor" },
      "People/Jane.md": { lineage_type: "person", name: "Jane Doe" }
    };

    const app = {
      vault: {
        getMarkdownFiles: () => files
      },
      metadataCache: {
        getFileCache: (file: TFile) => ({ frontmatter: frontmatterByPath[file.path] })
      }
    } as unknown as { vault: { getMarkdownFiles: () => TFile[] }; metadataCache: { getFileCache: (file: TFile) => { frontmatter?: Record<string, unknown> } } };

    const indexer = new VaultIndexer(app as never);
    indexer.rebuild();

    const results = indexer.findPersonByName("john");
    expect(results).toHaveLength(1);
    expect(results[0].basename).toBe("John");
  });

  it("indexes places by parent", () => {
    const files = [new TFile("Places/Cork.md", "Cork"), new TFile("Places/Ireland.md", "Ireland")];
    const frontmatterByPath: Record<string, Record<string, unknown>> = {
      "Places/Cork.md": { lineage_type: "place", name: "Cork", parent: "Ireland" },
      "Places/Ireland.md": { lineage_type: "place", name: "Ireland" }
    };

    const app = {
      vault: {
        getMarkdownFiles: () => files
      },
      metadataCache: {
        getFileCache: (file: TFile) => ({ frontmatter: frontmatterByPath[file.path] })
      }
    } as unknown as { vault: { getMarkdownFiles: () => TFile[] }; metadataCache: { getFileCache: (file: TFile) => { frontmatter?: Record<string, unknown> } } };

    const indexer = new VaultIndexer(app as never);
    indexer.rebuild();

    const results = indexer.findPlacesByParent("Ireland");
    expect(results).toHaveLength(1);
    expect(results[0].basename).toBe("Cork");
  });
});
