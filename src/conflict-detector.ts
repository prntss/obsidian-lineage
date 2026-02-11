import { Assertion } from "./types";

export type ConflictSeverity = "high" | "medium" | "low";

export type Conflict = {
  id: string;
  type: string;
  personRef: string;
  assertionIds: string[];
  severity: ConflictSeverity;
};

export function detectConflicts(assertions: Assertion[]): Conflict[] {
  const grouped = new Map<string, { type: string; personRef: string; ids: string[] }>();

  for (const assertion of assertions) {
    if (!assertion.participants || assertion.participants.length === 0) {
      continue;
    }

    for (const participant of assertion.participants) {
      const key = `${participant.person_ref}::${assertion.type}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.ids.push(assertion.id);
      } else {
        grouped.set(key, {
          type: assertion.type,
          personRef: participant.person_ref,
          ids: [assertion.id]
        });
      }
    }
  }

  const conflicts: Conflict[] = [];
  for (const entry of grouped.values()) {
    if (entry.ids.length < 2) {
      continue;
    }

    conflicts.push({
      id: `${entry.personRef}-${entry.type}`,
      type: entry.type,
      personRef: entry.personRef,
      assertionIds: entry.ids,
      severity: classifySeverity(entry.type)
    });
  }

  return conflicts;
}

function classifySeverity(type: string): ConflictSeverity {
  const normalized = type.toLowerCase();
  if (normalized === "birth" || normalized === "death") {
    return "high";
  }
  if (normalized === "marriage") {
    return "medium";
  }
  return "low";
}
