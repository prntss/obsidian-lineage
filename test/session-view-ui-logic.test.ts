import { describe, expect, it, vi } from "vitest";
import {
  ADD_ASSERTION_TYPES,
  getAssertionModalVisibility,
  SessionView,
  getMatchActionLabel,
  getMatchStatusDisplay
} from "../src/views/session-view";
import { App, WorkspaceLeaf } from "obsidian";
import { SessionManager } from "../src/session-manager";
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
        document: {}
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
});
