import { App, TFile } from "obsidian";
import { Session } from "./types";
import { classifyIdFormat } from "./utils/id";

export type ValidationIssueKind =
  | "required"
  | "format"
  | "conditional"
  | "integrity"
  | "id_policy";

export type ValidationSeverity = "error" | "warning";

export type ValidationCode =
  | "required_missing"
  | "document_capture_missing"
  | "url_format_invalid"
  | "locator_format_invalid"
  | "file_not_found"
  | "ref_missing"
  | "ref_invalid"
  | "id_invalid"
  | "id_fallback";

export type SessionValidationIssue = {
  fieldKey: string;
  text: string;
  level: ValidationSeverity;
  kind: ValidationIssueKind;
  code: ValidationCode;
};

export type SessionValidationResult = {
  issues: SessionValidationIssue[];
  blocking: boolean;
};

type EvaluateValidationOptions = {
  app?: App;
};

function isPlausibleUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) {
      return false;
    }
    if (parsed.hostname === "localhost") {
      return true;
    }
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

function shouldValidateLocatorAsUrl(locator: string): boolean {
  const trimmed = locator.trim();
  if (!trimmed) {
    return false;
  }
  return /^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed);
}

function pushRequiredIssue(
  issues: SessionValidationIssue[],
  fieldKey: string,
  text: string
): void {
  issues.push({
    fieldKey,
    text,
    level: "error",
    kind: "required",
    code: "required_missing"
  });
}

export function evaluateSessionValidation(
  session: Session,
  options: EvaluateValidationOptions = {}
): SessionValidationResult {
  const issues: SessionValidationIssue[] = [];
  const document = session.session.session.document;

  if (!session.metadata.title.trim()) {
    pushRequiredIssue(issues, "metadata.title", "Title is required.");
  }
  if (!session.metadata.record_type?.trim()) {
    pushRequiredIssue(issues, "metadata.record_type", "Record type is required.");
  }
  if (!session.metadata.repository.trim()) {
    pushRequiredIssue(issues, "metadata.repository", "Repository is required.");
  }
  if (!session.metadata.locator.trim()) {
    pushRequiredIssue(issues, "metadata.locator", "Locator is required.");
  }

  if (shouldValidateLocatorAsUrl(session.metadata.locator)) {
    const locator = session.metadata.locator.trim();
    if (!isPlausibleUrl(locator)) {
      issues.push({
        fieldKey: "metadata.locator",
        text: "Locator looks like a URL, but format appears invalid.",
        level: "warning",
        kind: "format",
        code: "locator_format_invalid"
      });
    }
  }

  const hasCapture =
    Boolean(document.url?.trim()) ||
    Boolean(document.file?.trim()) ||
    Boolean(document.transcription?.trim());
  if (!hasCapture) {
    issues.push({
      fieldKey: "document",
      text: "Provide a URL, file, or transcription to save the document.",
      level: "error",
      kind: "conditional",
      code: "document_capture_missing"
    });
  }

  const url = document.url?.trim() ?? "";
  if (url && !isPlausibleUrl(url)) {
    issues.push({
      fieldKey: "document.url",
      text: "URL looks invalid. You can still save, but verify it.",
      level: "warning",
      kind: "format",
      code: "url_format_invalid"
    });
  }

  const filePath = document.file?.trim() ?? "";
  if (filePath && options.app) {
    const file = options.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      issues.push({
        fieldKey: "document.file",
        text: "File not found in the vault.",
        level: "error",
        kind: "format",
        code: "file_not_found"
      });
    }
  }

  const sessionId = session.session.session.id?.trim() ?? "";
  const sessionIdFormat = classifyIdFormat(sessionId);
  if (sessionIdFormat === "invalid") {
    issues.push({
      fieldKey: "session.id",
      text: "Session ID is required and must use a valid ID format.",
      level: "error",
      kind: "id_policy",
      code: "id_invalid"
    });
  } else if (sessionIdFormat === "fallback") {
    issues.push({
      fieldKey: "session.id",
      text: "Session ID uses fallback format (UUID preferred).",
      level: "warning",
      kind: "id_policy",
      code: "id_fallback"
    });
  }

  const personIds = new Set(
    session.session.persons
      .map((person) => person.id?.trim())
      .filter((id): id is string => Boolean(id))
  );
  const citationIds = new Set(
    session.session.citations
      .map((citation) => citation.id?.trim())
      .filter((id): id is string => Boolean(id))
  );

  session.session.assertions.forEach((assertion, index) => {
    const assertionField = `assertions[${index}]`;
    if (assertion.type === "parent-child") {
      const parentRef = assertion.parent_ref?.trim();
      const childRef = assertion.child_ref?.trim();
      if (!parentRef || !childRef) {
        issues.push({
          fieldKey: assertionField,
          text: "Parent-child assertions require both parent and child references.",
          level: "error",
          kind: "integrity",
          code: "ref_missing"
        });
      } else {
        if (parentRef === childRef) {
          issues.push({
            fieldKey: assertionField,
            text: "Parent and child must reference different people.",
            level: "error",
            kind: "integrity",
            code: "ref_invalid"
          });
        }
        if (!personIds.has(parentRef) || !personIds.has(childRef)) {
          issues.push({
            fieldKey: assertionField,
            text: "Parent-child references must point to people in this session.",
            level: "error",
            kind: "integrity",
            code: "ref_invalid"
          });
        }
      }
    }

    for (const participant of assertion.participants ?? []) {
      if (!personIds.has(participant.person_ref)) {
        issues.push({
          fieldKey: assertionField,
          text: "Assertion participant references a missing session person.",
          level: "error",
          kind: "integrity",
          code: "ref_invalid"
        });
        break;
      }
    }

    for (const citationId of assertion.citations ?? []) {
      if (!citationIds.has(citationId)) {
        issues.push({
          fieldKey: assertionField,
          text: "Assertion citation reference does not exist in session citations.",
          level: "error",
          kind: "integrity",
          code: "ref_invalid"
        });
        break;
      }
    }
  });

  return {
    issues,
    blocking: issues.some((issue) => issue.level === "error")
  };
}
