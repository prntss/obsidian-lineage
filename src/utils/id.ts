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
