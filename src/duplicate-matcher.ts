export type MatchFeatures = {
  name?: number;
  date?: number;
  place?: number;
  relationship?: number;
};

export type MatchCandidate<T = unknown> = {
  id: string;
  features: MatchFeatures;
  data?: T;
  score?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function scoreName(nameA?: string, nameB?: string): number {
  if (!nameA?.trim() || !nameB?.trim()) {
    return 0;
  }

  const normalizedA = normalizeName(nameA);
  const normalizedB = normalizeName(nameB);

  if (!normalizedA || !normalizedB) {
    return 0;
  }

  if (normalizedA === normalizedB) {
    return 1;
  }

  const distance = levenshtein(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  const distanceScore = maxLength === 0 ? 0 : 1 - distance / maxLength;

  const soundexA = soundex(normalizedA);
  const soundexB = soundex(normalizedB);
  const phoneticScore =
    soundexA && soundexA === soundexB ? Math.max(distanceScore, 0.8) : distanceScore;

  return clamp(phoneticScore, 0, 1);
}

export function scoreDateOverlap(dateA?: string, dateB?: string): number {
  const rangeA = parseDateRange(dateA);
  const rangeB = parseDateRange(dateB);

  if (!rangeA || !rangeB) {
    return 0.5;
  }

  const overlapStart = Math.max(rangeA.start, rangeB.start);
  const overlapEnd = Math.min(rangeA.end, rangeB.end);

  if (overlapEnd < overlapStart) {
    return 0;
  }

  const overlap = overlapEnd - overlapStart + DAY_MS;
  const unionStart = Math.min(rangeA.start, rangeB.start);
  const unionEnd = Math.max(rangeA.end, rangeB.end);
  const union = unionEnd - unionStart + DAY_MS;

  return clamp(overlap / union, 0, 1);
}

export function computeCompositeScore(features: MatchFeatures): number {
  const name = normalizeScore(features.name, 0);
  const date = normalizeScore(features.date, 0.5);
  const place = normalizeScore(features.place, 0);
  const relationship = normalizeScore(features.relationship, 0);

  return clamp(
    name * 0.4 + date * 0.25 + place * 0.25 + relationship * 0.1,
    0,
    1
  );
}

export function rankCandidates(
  candidates: MatchCandidate[],
  options: { minScore?: number; limit?: number } = {}
): MatchCandidate[] {
  const minScore = options.minScore ?? 0.5;
  const limit = options.limit ?? 5;

  return candidates
    .map((candidate) => ({
      ...candidate,
      score: computeCompositeScore(candidate.features)
    }))
    .filter((candidate) => (candidate.score ?? 0) >= minScore)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

type DateRange = {
  start: number;
  end: number;
};

function parseDateRange(value?: string): DateRange | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isApproximate = trimmed.startsWith("~");
  const raw = isApproximate ? trimmed.slice(1).trim() : trimmed;

  const fullMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullMatch) {
    const year = Number(fullMatch[1]);
    const month = Number(fullMatch[2]) - 1;
    const day = Number(fullMatch[3]);
    const start = Date.UTC(year, month, day);
    const end = start;
    return expandApproximate({ start, end }, isApproximate, "day");
  }

  const monthMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]) - 1;
    const start = Date.UTC(year, month, 1);
    const end = Date.UTC(year, month + 1, 0);
    return expandApproximate({ start, end }, isApproximate, "month");
  }

  const yearMatch = raw.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    const start = Date.UTC(year, 0, 1);
    const end = Date.UTC(year, 11, 31);
    return expandApproximate({ start, end }, isApproximate, "year");
  }

  return null;
}

function expandApproximate(
  range: DateRange,
  approximate: boolean,
  precision: "year" | "month" | "day"
): DateRange {
  if (!approximate) {
    return range;
  }

  let paddingDays = 30;
  if (precision === "year") {
    paddingDays = 365;
  } else if (precision === "month") {
    paddingDays = 90;
  }

  const paddingMs = paddingDays * DAY_MS;
  return {
    start: range.start - paddingMs,
    end: range.end + paddingMs
  };
}

function normalizeScore(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return clamp(value, 0, 1);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^mc/, "mac")
    .replace(/sen\b/g, "son");
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function soundex(value: string): string {
  const trimmed = value.replace(/[^a-z]/g, "");
  if (!trimmed) {
    return "";
  }

  const firstLetter = trimmed[0].toUpperCase();
  const mappings: Record<string, string> = {
    b: "1",
    f: "1",
    p: "1",
    v: "1",
    c: "2",
    g: "2",
    j: "2",
    k: "2",
    q: "2",
    s: "2",
    x: "2",
    z: "2",
    d: "3",
    t: "3",
    l: "4",
    m: "5",
    n: "5",
    r: "6"
  };

  let result = firstLetter;
  let lastCode = mappings[trimmed[0]] ?? "";

  for (let i = 1; i < trimmed.length; i += 1) {
    const char = trimmed[i];
    const code = mappings[char] ?? "";
    if (code && code !== lastCode) {
      result += code;
    }
    if (code) {
      lastCode = code;
    }
    if (result.length >= 4) {
      break;
    }
  }

  return result.padEnd(4, "0");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
