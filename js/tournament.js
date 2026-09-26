import { CHARACTERS } from "./characters.js";
import { rankQualifiers, championshipWinners, assertScore } from "./scoring.js";

export const State = Object.freeze({
  TITLE: "title",
  INSTRUCTIONS: "instructions",
  QUALIFYING_INTRO: "qualifying-intro",
  READY: "ready",
  ACTIVE: "active-attempt",
  RESULTS: "attempt-results",
  ELIMINATION: "elimination",
  CHAMPIONSHIP_INTRO: "championship-intro",
  CHAMPIONSHIP_ACTIVE: "championship-attempt",
  FINAL: "final-results",
  RESTART: "restart",
});
const ALLOWED = {
  [State.TITLE]: [State.INSTRUCTIONS],
  [State.INSTRUCTIONS]: [State.QUALIFYING_INTRO],
  [State.QUALIFYING_INTRO]: [State.READY],
  [State.READY]: [State.ACTIVE, State.CHAMPIONSHIP_ACTIVE],
  [State.ACTIVE]: [State.RESULTS, State.READY],
  [State.CHAMPIONSHIP_ACTIVE]: [State.RESULTS, State.READY],
  [State.RESULTS]: [State.READY, State.ELIMINATION, State.FINAL],
  [State.ELIMINATION]: [State.CHAMPIONSHIP_INTRO],
  [State.CHAMPIONSHIP_INTRO]: [State.READY],
  [State.FINAL]: [State.RESTART],
  [State.RESTART]: [State.TITLE],
};

export class Tournament {
  constructor() {
    this.state = State.TITLE;
    this.resetScores();
  }
  resetScores() {
    this.round = "qualifying";
    this.turn = 0;
    this.qualifying = {};
    this.championship = {};
    this.finalists = [];
    this.eliminated = null;
    this.lastScore = null;
    this.winners = [];
  }
  get active() {
    return (
      this.state === State.ACTIVE || this.state === State.CHAMPIONSHIP_ACTIVE
    );
  }
  get roster() {
    return this.round === "qualifying" ? CHARACTERS : this.finalists;
  }
  get current() {
    return this.roster[this.turn];
  }
  get next() {
    return this.roster[this.turn + 1] || null;
  }
  get crashOfNight() {
    let best = null;
    for (const round of ["qualifying", "championship"])
      for (const character of round === "qualifying" ? CHARACTERS : this.finalists) {
        const score = this[round][character.id];
        if (score?.crashed && score.carnage && (!best || score.carnage.total > best.carnage.total))
          best = { character, carnage: score.carnage, round };
      }
    return best;
  }
  transition(next) {
    if (!ALLOWED[this.state]?.includes(next))
      throw new Error(`Invalid tournament transition: ${this.state} → ${next}`);
    this.state = next;
  }
  confirm() {
    switch (this.state) {
      case State.TITLE:
        this.transition(State.INSTRUCTIONS);
        break;
      case State.INSTRUCTIONS:
        this.transition(State.QUALIFYING_INTRO);
        break;
      case State.QUALIFYING_INTRO:
      case State.CHAMPIONSHIP_INTRO:
        this.transition(State.READY);
        break;
      case State.READY:
        this.transition(
          this.round === "qualifying"
            ? State.ACTIVE
            : State.CHAMPIONSHIP_ACTIVE,
        );
        break;
      case State.RESULTS:
        if (this.next) {
          this.turn++;
          this.transition(State.READY);
        } else if (this.round === "qualifying") {
          const ranked = rankQualifiers(CHARACTERS, this.qualifying);
          this.finalists = ranked.slice(0, 2).reverse();
          this.eliminated = ranked[2];
          this.transition(State.ELIMINATION);
        } else {
          this.winners = championshipWinners(this.finalists, this.championship);
          this.transition(State.FINAL);
        }
        break;
      case State.ELIMINATION:
        this.round = "championship";
        this.turn = 0;
        this.transition(State.CHAMPIONSHIP_INTRO);
        break;
      case State.FINAL:
        this.transition(State.RESTART);
        this.resetScores();
        this.transition(State.TITLE);
        break;
    }
    return this.state;
  }
  record(score) {
    if (!this.active) return false;
    assertScore(score);
    if (this[this.round][this.current.id]) return false;
    const saved = Object.freeze({ ...score });
    this[this.round][this.current.id] = saved;
    this.lastScore = saved;
    this.transition(State.RESULTS);
    return true;
  }
  resetAttempt() {
    if (!this.active) return false;
    this.transition(State.READY);
    return true;
  }
}
