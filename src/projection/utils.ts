import yaml from "js-yaml";
import { App, TFile, normalizePath } from "obsidian";

const YAML_OPTIONS: yaml.DumpOptions = {
  indent: 2,
  lineWidth: 80,
  noRefs: true,
  sortKeys: false
};

export function extractLinkTarget(value: string): string {
  const trimmed = value.trim();
  const noBrackets = trimmed.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const [target] = noBrackets.split("|");
  return target.trim();
}

export function formatWikilink(value: string): string {
  return `[[${value}]]`;
}

export function orderParticipants<T extends { principal?: boolean; role?: string }>(participants: T[]): T[] {
  const principal = participants.find(
    (participant) => participant.principal === true || participant.role === "principal"
  );
  if (!principal) {
    return participants;
  }
  return [principal, ...participants.filter((participant) => participant !== principal)];
}

export function getUniquePath(app: App, path: string): string {
  const normalized = normalizePath(path);
  if (!app.vault.getAbstractFileByPath(normalized)) {
    return normalized;
  }

  const extIndex = normalized.lastIndexOf(".");
  const hasExt = extIndex > normalized.lastIndexOf("/");
  const base = hasExt ? normalized.slice(0, extIndex) : normalized;
  const ext = hasExt ? normalized.slice(extIndex) : "";

  let counter = 2;
  while (true) {
    const candidate = `${base} (${counter})${ext}`;
    if (!app.vault.getAbstractFileByPath(candidate)) {
      return candidate;
    }
    counter += 1;
  }
}

export async function createFile(app: App, path: string, content: string): Promise<TFile> {
  const normalized = normalizePath(path);
  return app.vault.create(normalized, content);
}

export async function updateFrontmatter(
  app: App,
  file: TFile,
  updates: Record<string, unknown>
): Promise<void> {
  const fileManager = (app as App & { fileManager?: { processFrontMatter?: (file: TFile, fn: (frontmatter: Record<string, unknown>) => void) => Promise<void> } }).fileManager;
  if (fileManager?.processFrontMatter) {
    await fileManager.processFrontMatter(file, (frontmatter) => {
      Object.assign(frontmatter, updates);
    });
    return;
  }

  await app.vault.process(file, (content) => {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const existing = frontmatterMatch
      ? ((yaml.load(frontmatterMatch[1]) as Record<string, unknown> | null) ?? {})
      : {};
    const next = { ...existing, ...updates };
    const frontmatterYaml = yaml.dump(next, YAML_OPTIONS).trimEnd();
    const body = frontmatterMatch
      ? content.slice(frontmatterMatch[0].length).replace(/^\r?\n/, "")
      : content;
    return `---\n${frontmatterYaml}\n---\n\n${body.trimStart()}`;
  });
}
