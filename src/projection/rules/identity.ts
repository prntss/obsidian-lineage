import { Assertion, Person, Session } from "../../types";
import { ProjectionContext, ProjectionState, ProjectionSummary } from "../types";
import { ensurePersonFile, recordAssertionTarget } from "../helpers";

function applyIdentityDetails(person: Person, assertion: Assertion): Person {
  const name = typeof assertion.name === "string" ? assertion.name : "";
  if (!person.name && name) {
    person.name = name;
  }
  const sex = typeof assertion.sex === "string" ? assertion.sex : "";
  if (!person.sex && sex) {
    person.sex = sex;
  }
  return person;
}

export async function projectIdentityAssertions(
  context: ProjectionContext,
  summary: ProjectionSummary,
  state: ProjectionState,
  session: Session
): Promise<void> {
  const assertions = session.session.assertions.filter(
    (assertion) => assertion.type === "identity"
  );

  if (assertions.length === 0) {
    return;
  }

  const personsById = new Map(session.session.persons.map((person) => [person.id, person]));

  for (const assertion of assertions) {
    const participants = assertion.participants ?? [];
    for (const participant of participants) {
      const person = personsById.get(participant.person_ref);
      if (!person) {
        summary.errors.push(`Identity assertion references missing person ${participant.person_ref}.`);
        continue;
      }
      const updated = applyIdentityDetails(person, assertion);
      const file = await ensurePersonFile(context, state, summary, updated);
      recordAssertionTarget(state, assertion.id, "person", file);
    }
  }
}
