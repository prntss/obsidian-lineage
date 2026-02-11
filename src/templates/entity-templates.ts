import yaml from "js-yaml";
import { generateLineageId } from "../utils/id";

const YAML_OPTIONS: yaml.DumpOptions = {
  indent: 2,
  lineWidth: 80,
  noRefs: true,
  sortKeys: false
};

function buildTemplate(frontmatter: Record<string, unknown>, body: string): string {
  const frontmatterYaml = yaml.dump(frontmatter, YAML_OPTIONS).trimEnd();
  return `---\n${frontmatterYaml}\n---\n\n${body}`.trimEnd() + "\n";
}

export type PersonTemplateData = {
  lineage_id?: string;
  name: string;
  sex?: string;
};

export function buildPersonTemplate(data: PersonTemplateData): string {
  const frontmatter = {
    lineage_type: "person",
    lineage_id: data.lineage_id ?? generateLineageId(),
    name: data.name,
    sex: data.sex ?? undefined
  };

  const body = "## Events\n\n## Relationships\n\n## Citations\n";
  return buildTemplate(frontmatter, body);
}

export type EventTemplateData = {
  lineage_id?: string;
  event_type: string;
  date?: string;
  place?: string;
  participants?: string[];
};

export function buildEventTemplate(data: EventTemplateData): string {
  const frontmatter = {
    lineage_type: "event",
    lineage_id: data.lineage_id ?? generateLineageId(),
    event_type: data.event_type,
    date: data.date ?? undefined,
    place: data.place ?? undefined,
    participants: data.participants && data.participants.length > 0 ? data.participants : undefined
  };

  const body = "## Participants\n\n## Citations\n";
  return buildTemplate(frontmatter, body);
}

export type PlaceTemplateData = {
  lineage_id?: string;
  name: string;
  parent_place?: string;
};

export function buildPlaceTemplate(data: PlaceTemplateData): string {
  const frontmatter = {
    lineage_type: "place",
    lineage_id: data.lineage_id ?? generateLineageId(),
    name: data.name,
    parent_place: data.parent_place ?? undefined
  };

  const body = "## Events\n";
  return buildTemplate(frontmatter, body);
}

export type RelationshipTemplateData = {
  lineage_id?: string;
  relationship_type: string;
  person_a: string;
  person_b: string;
  person_a_role?: string;
  person_b_role?: string;
  date?: string;
  place?: string;
};

export function buildRelationshipTemplate(data: RelationshipTemplateData): string {
  const frontmatter = {
    lineage_type: "relationship",
    lineage_id: data.lineage_id ?? generateLineageId(),
    relationship_type: data.relationship_type,
    person_a: data.person_a,
    person_b: data.person_b,
    person_a_role: data.person_a_role ?? undefined,
    person_b_role: data.person_b_role ?? undefined,
    date: data.date ?? undefined,
    place: data.place ?? undefined
  };

  const body = "## Events\n\n## Citations\n";
  return buildTemplate(frontmatter, body);
}

export type SourceTemplateData = {
  lineage_id?: string;
  title: string;
  record_type?: string;
  repository?: string;
  locator?: string;
  date?: string;
};

export function buildSourceTemplate(data: SourceTemplateData): string {
  const frontmatter = {
    lineage_type: "source",
    lineage_id: data.lineage_id ?? generateLineageId(),
    title: data.title,
    record_type: data.record_type ?? undefined,
    repository: data.repository ?? undefined,
    locator: data.locator ?? undefined,
    date: data.date ?? undefined
  };

  const body = "## Citations\n";
  return buildTemplate(frontmatter, body);
}

export type CitationTemplateData = {
  lineage_id?: string;
  source_id: string;
  target_entity_id: string;
  target_entity_type: string;
  assertion_id: string;
  snippet?: string;
  locator?: string;
};

export function buildCitationTemplate(data: CitationTemplateData): string {
  const frontmatter = {
    lineage_type: "citation",
    lineage_id: data.lineage_id ?? generateLineageId(),
    source_id: data.source_id,
    target_entity_id: data.target_entity_id,
    target_entity_type: data.target_entity_type,
    assertion_id: data.assertion_id,
    snippet: data.snippet ?? undefined,
    locator: data.locator ?? undefined
  };

  const snippet = data.snippet ?? "";
  const body = `## Snippet\n\n${snippet}\n`;
  return buildTemplate(frontmatter, body);
}
