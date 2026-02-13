import { describe, expect, it, vi } from "vitest";
import {
  ADD_ASSERTION_TYPES,
  getAssertionModalVisibility,
  getUnanchoredBlockingIssues,
  SessionView,
  getMatchActionLabel,
  getMatchStatusDisplay
} from "../src/views/session-view";
import { App, WorkspaceLeaf } from "obsidian";
import { SessionManager } from "../src/session-manager";
import { SessionValidationIssue } from "../src/session-validation";
import { Person, Session } from "../src/types";

function buildSession(persons: Person[]): Session {
  return {
    metadata: {
      lineage_type: "research_session",
      title: "Test Session",
      record_type: "other",
      repository: "Repo",
      locator: "Loc",
      projected_entities: []
    },
    session: {
      session: {
        id: "session-1",
        document: { files: [] }
      },
      sources: [],
      persons,
      assertions: [],
      citations: []
    },
    freeformNotes: ""
  };
}

function buildSessionViewForMatchTest(options: {
  person: Person;
  onModalCreate?: (onConfirm: (matchedTo: string | null) => void) => void;
}) {
  const leaf = new WorkspaceLeaf();
  const sessionManager = new SessionManager();
  const vaultIndexer = {
    getPersonEntries: () => []
  } as never;
  const settings = {
    baseFolder: "Lineage"
  };
  const modalOpenSpy = vi.fn();
  const createMatchModal = vi.fn(
    (
      _app: App,
      _person: Person,
      _candidates: unknown[],
      onConfirm: (matchedTo: string | null) => void
    ) => {
      options.onModalCreate?.(onConfirm);
      return { open: modalOpenSpy };
    }
  );

  const view = new SessionView(
    leaf,
    sessionManager,
    vaultIndexer,
    settings,
    createMatchModal as never
  ) as unknown as Record<string, unknown>;

  view.currentSession = buildSession([options.person]);
  view.renderSession = vi.fn();
  view.scheduleIdleSave = vi.fn();

  return {
    view: view as SessionView & Record<string, unknown>,
    createMatchModal,
    modalOpenSpy
  };
}

describe("session-view ui logic", () => {
  describe("getAssertionModalVisibility", () => {
    it("shows parent-child controls only for parent-child assertions", () => {
      for (const type of ADD_ASSERTION_TYPES) {
        const visibility = getAssertionModalVisibility(type);
        if (type === "parent-child") {
          expect(visibility.showParentChild).toBe(true);
          expect(visibility.showParticipants).toBe(false);
        } else {
          expect(visibility.showParentChild).toBe(false);
          expect(visibility.showParticipants).toBe(true);
        }
      }
    });

    it("shows identity-only fields only for identity assertions", () => {
      expect(getAssertionModalVisibility("identity").showIdentityFields).toBe(true);
      expect(getAssertionModalVisibility("birth").showIdentityFields).toBe(false);
      expect(getAssertionModalVisibility("freeform").showIdentityFields).toBe(false);
    });

    it("treats unknown assertion types as participant-based", () => {
      const visibility = getAssertionModalVisibility("baptism");
      expect(visibility.showParticipants).toBe(true);
      expect(visibility.showParentChild).toBe(false);
      expect(visibility.showIdentityFields).toBe(false);
    });
  });

  describe("matching label and status", () => {
    it("uses Match/⚠ unmatched for empty match state", () => {
      expect(getMatchActionLabel(null)).toBe("Match");
      expect(getMatchActionLabel(undefined)).toBe("Match");
      expect(getMatchActionLabel("")).toBe("Match");
      expect(getMatchActionLabel("   ")).toBe("Match");

      expect(getMatchStatusDisplay(null)).toEqual({ text: "⚠ unmatched" });
      expect(getMatchStatusDisplay("   ")).toEqual({ text: "⚠ unmatched" });
    });

    it("uses Rematch/✓ matched for present match state", () => {
      const matchedTo = "[[Jane Doe]]";
      expect(getMatchActionLabel(matchedTo)).toBe("Rematch");
      expect(getMatchStatusDisplay(matchedTo)).toEqual({
        text: "✓ matched",
        title: "Matched to [[Jane Doe]]"
      });
    });

    it("updates person match state when modal confirm callback is invoked", () => {
      const person: Person = { id: "p1", name: "John Doe", matched_to: null };
      let onConfirm: ((matchedTo: string | null) => void) | null = null;
      const { view, modalOpenSpy } = buildSessionViewForMatchTest({
        person,
        onModalCreate: (callback) => {
          onConfirm = callback;
        }
      });

      (view as Record<string, unknown>).openMatchModal(person);
      expect(modalOpenSpy).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toBeNull();

      onConfirm!("[[John Doe (1900-1970)]]");
      expect(person.matched_to).toBe("[[John Doe (1900-1970)]]");
      expect((view as Record<string, unknown>).renderSession).toHaveBeenCalledTimes(1);
      expect((view as Record<string, unknown>).scheduleIdleSave).toHaveBeenCalledTimes(1);
    });

    it("leaves person match state unchanged when modal is dismissed", () => {
      const person: Person = {
        id: "p1",
        name: "Jane Doe",
        matched_to: "[[Jane Doe (1871-1938)]]"
      };
      const { view, modalOpenSpy } = buildSessionViewForMatchTest({ person });

      (view as Record<string, unknown>).openMatchModal(person);
      expect(modalOpenSpy).toHaveBeenCalledTimes(1);
      expect(person.matched_to).toBe("[[Jane Doe (1871-1938)]]");
      expect((view as Record<string, unknown>).renderSession).not.toHaveBeenCalled();
      expect((view as Record<string, unknown>).scheduleIdleSave).not.toHaveBeenCalled();
    });

    it("updates displayed match target when a different candidate is selected", () => {
      const person: Person = {
        id: "p1",
        name: "Jane Doe",
        matched_to: "[[Jane Doe (1871-1938)]]"
      };
      let onConfirm: ((matchedTo: string | null) => void) | null = null;
      const { view } = buildSessionViewForMatchTest({
        person,
        onModalCreate: (callback) => {
          onConfirm = callback;
        }
      });

      (view as Record<string, unknown>).openMatchModal(person);
      onConfirm!("[[Jane Doe (1901-1978)]]");

      expect(person.matched_to).toBe("[[Jane Doe (1901-1978)]]");
      expect(getMatchStatusDisplay(person.matched_to).title).toBe(
        "Matched to [[Jane Doe (1901-1978)]]"
      );
    });
  });

  describe("non-field blocking summary selection", () => {
    it("returns only unanchored blocking issues, deduped and sorted", () => {
      const issues: SessionValidationIssue[] = [
        {
          fieldKey: "assertions[0]",
          text: "Assertion participant references a missing session person.",
          level: "error",
          kind: "integrity",
          code: "ref_invalid"
        },
        {
          fieldKey: "assertions[0]",
          text: "Assertion participant references a missing session person.",
          level: "error",
          kind: "integrity",
          code: "ref_invalid"
        },
        {
          fieldKey: "metadata.title",
          text: "Title is required.",
          level: "error",
          kind: "required",
          code: "required_missing"
        },
        {
          fieldKey: "session.id",
          text: "Session ID uses fallback format (UUID preferred).",
          level: "warning",
          kind: "id_policy",
          code: "id_fallback"
        },
        {
          fieldKey: "session.id",
          text: "Session ID is required and must use a valid ID format.",
          level: "error",
          kind: "id_policy",
          code: "id_invalid"
        }
      ];

      const result = getUnanchoredBlockingIssues(
        issues,
        (fieldKey) => fieldKey === "metadata.title"
      );

      expect(result).toEqual([
        {
          fieldKey: "assertions[0]",
          text: "Assertion participant references a missing session person.",
          level: "error",
          kind: "integrity",
          code: "ref_invalid"
        },
        {
          fieldKey: "session.id",
          text: "Session ID is required and must use a valid ID format.",
          level: "error",
          kind: "id_policy",
          code: "id_invalid"
        }
      ]);
    });
  });

  describe("autosave timer scheduling", () => {
    it("fires auto-save only after configured delay", () => {
      vi.useFakeTimers();
      const previousWindow = (globalThis as { window?: unknown }).window;
      (globalThis as { window: typeof globalThis }).window = globalThis;
      try {
        const leaf = new WorkspaceLeaf();
        const sessionManager = new SessionManager();
        const vaultIndexer = {
          getPersonEntries: () => []
        } as never;
        const settings = {
          baseFolder: "Lineage"
        };
        const view = new SessionView(
          leaf,
          sessionManager,
          vaultIndexer,
          settings
        ) as unknown as Record<string, unknown>;
        const saveSessionSpy = vi.fn();
        (view as { saveSession: unknown }).saveSession = saveSessionSpy;

        (view as { scheduleSave: (delay?: number) => void }).scheduleSave(400);
        vi.advanceTimersByTime(399);
        expect(saveSessionSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(saveSessionSpy).toHaveBeenCalledTimes(1);
        expect(saveSessionSpy).toHaveBeenCalledWith({ trigger: "auto" });
      } finally {
        if (previousWindow === undefined) {
          delete (globalThis as { window?: unknown }).window;
        } else {
          (globalThis as { window: unknown }).window = previousWindow;
        }
        vi.useRealTimers();
      }
    });
  });

  describe("person deletion integrity guard", () => {
    it("blocks deleting a person referenced by assertion participants", () => {
      const leaf = new WorkspaceLeaf();
      const view = new SessionView(
        leaf,
        new SessionManager(),
        { getPersonEntries: () => [] } as never,
        { baseFolder: "Lineage" }
      ) as unknown as SessionView & Record<string, unknown>;
      view.currentSession = {
        ...buildSession([
          { id: "p1", name: "John Doe" },
          { id: "p2", name: "Jane Doe" }
        ]),
        session: {
          ...buildSession([]).session,
          session: { id: "session-1", document: { files: [] } },
          persons: [
            { id: "p1", name: "John Doe" },
            { id: "p2", name: "Jane Doe" }
          ],
          assertions: [{ id: "a1", type: "birth", participants: [{ person_ref: "p1" }] }],
          citations: [],
          sources: []
        }
      };
      view.renderSession = vi.fn();
      view.scheduleSave = vi.fn();

      (view as Record<string, unknown>).removePerson("p1");

      expect(view.currentSession?.session.persons.map((person) => person.id)).toEqual([
        "p1",
        "p2"
      ]);
      expect((view as Record<string, unknown>).personActionMessage).toContain(
        "Cannot remove person: referenced by 1 assertion (a1)."
      );
      expect(view.renderSession).not.toHaveBeenCalled();
      expect(view.scheduleSave).not.toHaveBeenCalled();
    });

    it("blocks deleting a person referenced by parent-child assertion", () => {
      const leaf = new WorkspaceLeaf();
      const view = new SessionView(
        leaf,
        new SessionManager(),
        { getPersonEntries: () => [] } as never,
        { baseFolder: "Lineage" }
      ) as unknown as SessionView & Record<string, unknown>;
      view.currentSession = {
        ...buildSession([
          { id: "p1", name: "Parent" },
          { id: "p2", name: "Child" }
        ]),
        session: {
          ...buildSession([]).session,
          session: { id: "session-1", document: { files: [] } },
          persons: [
            { id: "p1", name: "Parent" },
            { id: "p2", name: "Child" }
          ],
          assertions: [{ id: "a1", type: "parent-child", parent_ref: "p1", child_ref: "p2" }],
          citations: [],
          sources: []
        }
      };
      view.renderSession = vi.fn();
      view.scheduleSave = vi.fn();

      (view as Record<string, unknown>).removePerson("p1");

      expect(view.currentSession?.session.persons.map((person) => person.id)).toEqual([
        "p1",
        "p2"
      ]);
      expect((view as Record<string, unknown>).personActionMessage).toContain(
        "Cannot remove person: referenced by 1 assertion (a1)."
      );
      expect(view.renderSession).not.toHaveBeenCalled();
      expect(view.scheduleSave).not.toHaveBeenCalled();
    });

    it("allows deleting a person with no assertion references", () => {
      const leaf = new WorkspaceLeaf();
      const view = new SessionView(
        leaf,
        new SessionManager(),
        { getPersonEntries: () => [] } as never,
        { baseFolder: "Lineage" }
      ) as unknown as SessionView & Record<string, unknown>;
      view.currentSession = {
        ...buildSession([
          { id: "p1", name: "John Doe" },
          { id: "p2", name: "Jane Doe" }
        ]),
        session: {
          ...buildSession([]).session,
          session: { id: "session-1", document: { files: [] } },
          persons: [
            { id: "p1", name: "John Doe" },
            { id: "p2", name: "Jane Doe" }
          ],
          assertions: [{ id: "a1", type: "birth", participants: [{ person_ref: "p2" }] }],
          citations: [],
          sources: []
        }
      };
      view.renderSession = vi.fn();
      view.scheduleSave = vi.fn();

      (view as Record<string, unknown>).removePerson("p1");

      expect(view.currentSession?.session.persons.map((person) => person.id)).toEqual(["p2"]);
      expect((view as Record<string, unknown>).personActionMessage).toBeNull();
      expect(view.renderSession).toHaveBeenCalledTimes(1);
      expect(view.scheduleSave).toHaveBeenCalledTimes(1);
    });
  });
});
