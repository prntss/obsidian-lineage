export function formatDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
