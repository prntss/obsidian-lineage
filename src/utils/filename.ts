const INVALID_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeFilename(value: string, maxLength = 120): string {
  const cleaned = value
    .replace(INVALID_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  const truncated = cleaned.length > maxLength ? cleaned.slice(0, maxLength).trim() : cleaned;
  return truncated || "Untitled";
}

export function extractYear(value?: string): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(/(\d{4})/);
  return match ? match[1] : null;
}

export function titleCase(value: string): string {
  if (!value) {
    return value;
  }
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function personFilename(name: string): string {
  return sanitizeFilename(name);
}

export function placeFilename(name: string): string {
  return sanitizeFilename(name);
}

export function eventFilename(type: string, principal: string, year?: string | null): string {
  const safeType = titleCase(type);
  const safePrincipal = sanitizeFilename(principal);
  const parts = [safeType, safePrincipal];
  if (year) {
    parts.push(year);
  }
  return sanitizeFilename(parts.join(" - "));
}

export function relationshipFilename(personA: string, personB: string): string {
  const safeA = sanitizeFilename(personA);
  const safeB = sanitizeFilename(personB);
  return sanitizeFilename(`Relationship - ${safeA} & ${safeB}`);
}

export function parentChildFilename(parentName: string, childName: string): string {
  const safeParent = sanitizeFilename(parentName);
  const safeChild = sanitizeFilename(childName);
  return sanitizeFilename(`Child of ${safeParent} - ${safeChild}`);
}

export function sourceFilename(recordType: string, principal?: string | null, year?: string | null): string {
  const safeType = titleCase(recordType || "Source");
  if (!principal || !year) {
    return sanitizeFilename(`${safeType} - Untitled`);
  }
  return sanitizeFilename(`${safeType} - ${sanitizeFilename(principal)} - ${year}`);
}

export function citationFilename(
  sourceTitle: string,
  targetLabel: string,
  assertionId: string
): string {
  return sanitizeFilename(`Citation - ${sourceTitle} - ${targetLabel} (${assertionId})`);
}
