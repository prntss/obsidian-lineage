const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FALLBACK_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  // Fallback for environments without randomUUID
  const random = Math.random().toString(16).slice(2);
  const timestamp = Date.now().toString(16);
  return `${timestamp}-${random}`;
}

export function generateLineageId(): string {
  return generateSessionId();
}

export type IdFormat = "uuid" | "fallback" | "invalid";

export function classifyIdFormat(value: string): IdFormat {
  const trimmed = value.trim();
  if (!trimmed) {
    return "invalid";
  }
  if (UUID_REGEX.test(trimmed)) {
    return "uuid";
  }
  if (FALLBACK_ID_REGEX.test(trimmed)) {
    return "fallback";
  }
  return "invalid";
}

export function isUuid(value: string): boolean {
  return classifyIdFormat(value) === "uuid";
}
