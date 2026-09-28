import { CHARACTERS } from "./characters.js";
import { assertScore } from "./scoring.js";
import { seededShuffle, newRunSeed } from "./run-random.js";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  CHAOS_CONDITIONS,
  normalizeSetup,
  displayName,
  DEFAULT_SETUP,
} from "./party-config.js";

export const State = Object.freeze({
  TITLE: "title",
  SETUP: "party-setup",
  INSTRUCTIONS: "instructions",
  ROUND_INTRO: "round-intro",
  READY: "ready",
  ACTIVE: "active-attempt",
  RESULTS: "attempt-results",
  SCOREBOARD: "scoreboard",
  FINAL: "final-results",
  RESTART: "restart",
});
const ALLOWED = {
  [State.TITLE]: [State.SETUP],
  [State.SETUP]: [State.INSTRUCTIONS, State.TITLE],
  [State.INSTRUCTIONS]: [State.ROUND_INTRO],
  [State.ROUND_INTRO]: [State.READY],
  [State.READY]: [State.ACTIVE],
  [State.ACTIVE]: [State.RESULTS, State.READY],
  [State.RESULTS]: [State.READY, State.SCOREBOARD, State.FINAL],
  [State.SCOREBOARD]: [State.ROUND_INTRO],
  [State.FINAL]: [State.RESTART],
  [State.RESTART]: [State.TITLE, State.SETUP],
};
const characterById = (id) => CHARACTERS.find((c) => c.id === id);

// Party Tournament: 2–6 named players, each on any character (duplicates
// allowed). Scores are kept per player, never per character.
export class Tournament {
  constructor(setup = DEFAULT_SETUP, { seedFactory = newRunSeed } = {}) {
    this.state = State.TITLE;
    this.seedFactory = seedFactory;
    this.setup = normalizeSetup(setup);
    this.resetScores();
  }
  // A fresh game from the current setup. Round 1 always exists so that the
  // current player is defined before the first hand-off.
  resetScores() {
    this.players = this.setup.players.map((p, i) => ({
      id: `p${i + 1}`,
      index: i,
      name: displayName(p.name, i),
      character: characterById(p.characterId),
    }));
    this.format = this.setup.format;
    this.chaos = this.setup.chaos;
    this.seed = this.seedFactory() >>> 0;
    this.chaosBag = seededShuffle(CHAOS_CONDITIONS, this.seed, "party-chaos");
    this.alive = this.players.map((p) => p.id);
    this.eliminated = [];
    this.lastEliminated = null;
    this.rounds = [];
    this.roundIndex = 0;
    this.turn = 0;
    this.lastScore = null;
    this.winners = [];
    this.awards = null;
    this.createRound();
  }
  createRound() {
    const index = this.rounds.length;
    this.rounds.push({
      number: index + 1,
      // A shuffled bag: every condition appears once before any repeats.
      condition: this.chaos
        ? this.chaosBag[index % this.chaosBag.length]
        : null,
      order: [...this.alive],
      scores: {},
    });
    this.roundIndex = index;
    this.turn = 0;
  }
  // --- Setup (only while the setup screen is open) ---
  editSetup(change) {
    if (this.state !== State.SETUP) return false;
    const players = this.setup.players.map((p) => ({ ...p }));
    switch (change.type) {
      case "name":
        if (players[change.index]) players[change.index].name = change.value;
        break;
      case "character":
        if (players[change.index] && characterById(change.value))
          players[change.index].characterId = change.value;
        break;
      case "add":
        if (players.length >= MAX_PLAYERS) return false;
        players.push({
          name: "",
          characterId: CHARACTERS[players.length % CHARACTERS.length].id,
        });
        break;
      case "remove":
        if (players.length <= MIN_PLAYERS || !players[change.index])
          return false;
        players.splice(change.index, 1);
        break;
      case "format":
        this.setup = normalizeSetup({ ...this.setup, players, format: change.value });
        return true;
      case "chaos":
        this.setup = normalizeSetup({ ...this.setup, players, chaos: Boolean(change.value) });
        return true;
      default:
        return false;
    }
    // Names stay raw while typing; normalizeSetup trims them on start.
    this.setup = { ...this.setup, players };
    return true;
  }
  // --- Queries ---
  get active() {
    return this.state === State.ACTIVE;
  }
  get currentRound() {
    return this.rounds[this.roundIndex];
  }
  get totalRounds() {
    return this.format === "quick"
      ? 1
      : this.format === "best-of-3"
        ? 3
        : this.players.length - 1;
  }
  get isFinalRound() {
    return this.format === "elimination"
      ? this.currentRound.order.length <= 2
      : this.roundIndex >= this.totalRounds - 1;
  }
  // Commentary and music keep their two moods: early rounds and the final.
  get round() {
    return this.format !== "quick" && this.isFinalRound
      ? "championship"
      : "qualifying";
  }
  player(id) {
    return this.players.find((p) => p.id === id);
  }
  get roster() {
    return this.currentRound.order.map((id) => this.player(id));
  }
  get currentPlayer() {
    return this.roster[this.turn];
  }
  get nextPlayer() {
    return this.roster[this.turn + 1] || null;
  }
  // The character for the physics world, intros and commentary.
  get current() {
    return this.currentPlayer.character;
  }
  get next() {
    return this.nextPlayer?.character || null;
  }
  // Every recorded jump, in the order it happened.
  get jumps() {
    return this.rounds.flatMap((round) =>
      round.order
        .filter((id) => round.scores[id])
        .map((id) => ({
          player: this.player(id),
          round: round.number,
          condition: round.condition,
          score: round.scores[id],
        })),
    );
  }
  jumpsFor(id) {
    return this.jumps.filter((jump) => jump.player.id === id);
  }
  totalFor(id) {
    return this.jumpsFor(id).reduce((sum, jump) => sum + jump.score.total, 0);
  }
  bestJumpFor(id) {
    return this.jumpsFor(id).reduce(
      (best, jump) =>
        !best || jump.score.total > best.score.total ? jump : best,
      null,
    );
  }
  // Higher total first, then the better single jump, then roster order.
  compare(a, b) {
    const bestA = this.bestJumpFor(a.id)?.score,
      bestB = this.bestJumpFor(b.id)?.score;
    return (
      this.totalFor(b.id) - this.totalFor(a.id) ||
      (bestB?.total ?? 0) - (bestA?.total ?? 0) ||
      (bestB?.distanceMetres ?? 0) - (bestA?.distanceMetres ?? 0) ||
      a.index - b.index
    );
  }
  // Players still in, ranked; eliminated players follow, latest out first.
  get standings() {
    const alive = this.alive
      .map((id) => this.player(id))
      .sort((a, b) => this.compare(a, b));
    const out = [...this.eliminated].reverse().map((entry) => entry.player);
    return [...alive, ...out].map((player) => ({
      player,
      total: this.totalFor(player.id),
      best: this.bestJumpFor(player.id),
      jumps: this.jumpsFor(player.id).length,
      out: this.eliminated.find((entry) => entry.player === player) || null,
    }));
  }
  get crashOfNight() {
    let best = null;
    for (const jump of this.jumps) {
      const s = jump.score;
      if (s?.crashed && s.carnage && (!best || s.carnage.total > best.carnage.total))
        best = {
          player: jump.player,
          character: jump.player.character,
          carnage: s.carnage,
          round: jump.round,
        };
    }
    return best;
  }
  // Fun awards for the end screen. Ties go to whoever did it first.
  computeAwards() {
    const top = (value, minimum = -Infinity) => {
      let best = null;
      for (const jump of this.jumps) {
        const v = value(jump.score);
        if (v > minimum && (!best || v > best.value)) best = { ...jump, value: v };
      }
      return best;
    };
    let consistent = null;
    for (const player of this.players) {
      const totals = this.jumpsFor(player.id).map((j) => j.score.total);
      if (totals.length < 2) continue;
      const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
      const spread = Math.sqrt(
        totals.reduce((sum, t) => sum + (t - mean) ** 2, 0) / totals.length,
      );
      if (
        !consistent ||
        spread < consistent.spread ||
        (spread === consistent.spread && mean > consistent.mean)
      )
        consistent = { player, spread, mean, jumps: totals.length };
    }
    return {
      longestJump: top((s) => s.distanceMetres),
      bestStyle: top((s) => s.stylePoints, 0),
      crashOfNight: this.crashOfNight,
      mostConsistent: consistent,
    };
  }
  // --- Flow ---
  transition(next) {
    if (!ALLOWED[this.state]?.includes(next))
      throw new Error(`Invalid tournament transition: ${this.state} → ${next}`);
    this.state = next;
  }
  back() {
    if (this.state !== State.SETUP) return false;
    this.transition(State.TITLE);
    return true;
  }
  rematch() {
    if (this.state !== State.FINAL) return false;
    this.transition(State.RESTART);
    this.resetScores();
    this.transition(State.SETUP);
    return true;
  }
  confirm() {
    switch (this.state) {
      case State.TITLE:
        this.transition(State.SETUP);
        break;
      case State.SETUP:
        this.setup = normalizeSetup(this.setup);
        this.resetScores();
        this.transition(State.INSTRUCTIONS);
        break;
      case State.INSTRUCTIONS:
        this.transition(State.ROUND_INTRO);
        break;
      case State.ROUND_INTRO:
        this.transition(State.READY);
        break;
      case State.READY:
        this.transition(State.ACTIVE);
        break;
      case State.RESULTS:
        if (this.nextPlayer) {
          this.turn++;
          this.transition(State.READY);
        } else this.finishRound();
        break;
      case State.SCOREBOARD:
        this.lastEliminated = null;
        this.createRound();
        this.transition(State.ROUND_INTRO);
        break;
      case State.FINAL:
        this.transition(State.RESTART);
        this.resetScores();
        this.transition(State.TITLE);
        break;
    }
    return this.state;
  }
  finishRound() {
    if (this.format === "elimination") {
      const ranked = this.alive
        .map((id) => this.player(id))
        .sort((a, b) => this.compare(a, b));
      const out = ranked.at(-1);
      this.alive = this.alive.filter((id) => id !== out.id);
      this.lastEliminated = out;
      this.eliminated.push({ player: out, round: this.currentRound.number });
      if (this.alive.length === 1) return this.finish([this.player(this.alive[0])]);
      this.transition(State.SCOREBOARD);
      return;
    }
    if (this.roundIndex < this.totalRounds - 1) {
      this.transition(State.SCOREBOARD);
      return;
    }
    const best = Math.max(...this.players.map((p) => this.totalFor(p.id)));
    this.finish(this.players.filter((p) => this.totalFor(p.id) === best));
  }
  finish(winners) {
    this.winners = winners;
    this.awards = this.computeAwards();
    this.transition(State.FINAL);
  }
  record(score) {
    if (!this.active) return false;
    assertScore(score);
    const scores = this.currentRound.scores;
    if (scores[this.currentPlayer.id]) return false;
    const saved = Object.freeze({ ...score });
    scores[this.currentPlayer.id] = saved;
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
