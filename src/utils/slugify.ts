export function slugify(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const slug = trimmed
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  return slug || "session";
}
