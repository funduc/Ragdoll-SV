import { CHARACTERS } from "./characters.js";
import { State } from "./tournament.js";
import { assertScore } from "./scoring.js";
import { LEVELS, levelById, evaluateMedal } from "./campaign-levels.js";
import { CampaignSave } from "./campaign-save.js";

export const CampaignState = Object.freeze({
  SELECT: "campaign-select",
  PROFILE: "campaign-profile",
  MAP: "campaign-map",
  RESET: "campaign-reset",
  READY: State.READY,
  ACTIVE: State.ACTIVE,
  RESULTS: State.RESULTS,
});
const S = CampaignState;
const allowed = {
  [S.SELECT]: [S.PROFILE],
  [S.PROFILE]: [S.SELECT, S.MAP],
  [S.MAP]: [S.SELECT, S.READY, S.RESET],
  [S.RESET]: [S.MAP],
  [S.READY]: [S.ACTIVE, S.MAP],
  [S.ACTIVE]: [S.RESULTS, S.READY],
  [S.RESULTS]: [S.MAP],
};
export function campaignFacts(score, world, reachedRamp) {
  return Object.freeze({
    finished: world.finished,
    invalid: world.invalid,
    reachedRamp,
    completedJump: world.launched && world.landed,
    goodPushes: score.pushCounts.Good + score.pushCounts.Perfect,
    perfectTakeoff: world.launched && score.takeoffGrade === "Perfect",
    goodBrace: ["Good Brace", "Perfect Brace"].includes(score.braceGrade),
    perfectBrace: score.braceGrade === "Perfect Brace",
    controlledLanding: !score.crashed && score.landingQuality === "Clean",
    successfulLanding:
      !score.crashed && ["Clean", "Scrappy"].includes(score.landingQuality),
    uniqueTricks: score.tricks.unique,
  });
}
export class Campaign {
  constructor(save = new CampaignSave()) {
    this.kind = "campaign";
    this.round = "vault run";
    this.save = save;
    this.state = S.SELECT;
    this.current = null;
    this.level = null;
    this.resetAttemptData();
  }
  get active() {
    return this.state === S.ACTIVE;
  }
  transition(next) {
    if (!allowed[this.state]?.includes(next))
      throw new Error(`Invalid campaign transition: ${this.state} → ${next}`);
    this.state = next;
  }
  select(characterId) {
    const c = CHARACTERS.find((c) => c.id === characterId);
    if (this.state !== S.SELECT || !c) return false;
    this.current = c;
    this.transition(S.PROFILE);
    return true;
  }
  confirm() {
    if (this.state === S.PROFILE) {
      this.save.select(this.current.id);
      this.transition(S.MAP);
    } else if (this.state === S.READY) this.transition(S.ACTIVE);
    else if (this.state === S.RESULTS || this.state === S.RESET)
      this.transition(S.MAP);
    // Selection and map require an explicit choice. Reset defaults to Cancel.
  }
  changeCharacter() {
    if (![S.MAP, S.PROFILE].includes(this.state)) return false;
    this.transition(S.SELECT);
    this.level = null;
    this.resetAttemptData();
    return true;
  }
  isUnlocked(level) {
    return Boolean(
      this.current &&
        level &&
        level.prerequisites.every(
          (id) => this.save.entry(this.current.id, id).medal >= 1,
        ),
    );
  }
  startLevel(id) {
    const level = levelById(id);
    if (this.state !== S.MAP || !this.isUnlocked(level)) return false;
    this.level = level;
    this.resetAttemptData();
    this.transition(S.READY);
    return true;
  }
  backToMap() {
    if (![S.READY, S.RESULTS, S.RESET].includes(this.state)) return false;
    this.transition(S.MAP);
    return true;
  }
  requestReset() {
    if (this.state !== S.MAP) return false;
    this.transition(S.RESET);
    return true;
  }
  confirmReset() {
    if (this.state !== S.RESET) return false;
    this.save.reset();
    this.level = null;
    this.resetAttemptData();
    this.transition(S.MAP);
    return true;
  }
  resetAttemptData() {
    this.reachedRamp = false;
    this.lastScore = null;
    this.lastMedal = null;
  }
  observe(world) {
    if (this.active && Number.isFinite(world.cart.position.x))
      this.reachedRamp ||= world.cart.position.x >= world.course.rampStart;
  }
  record(score, world) {
    if (!this.active || !world.finished || this.lastScore)
      throw new Error("Campaign attempt is not ready to record.");
    assertScore(score);
    this.observe(world);
    const facts = campaignFacts(score, world, this.reachedRamp);
    const earned = evaluateMedal(this.level, facts);
    this.lastScore = score;
    this.lastMedal = Object.freeze({
      ...earned,
      facts,
      ...this.save.award(this.current.id, this.level.id, earned),
    });
    this.transition(S.RESULTS);
  }
  resetAttempt() {
    if (!this.active) return false;
    this.resetAttemptData();
    this.transition(S.READY);
    return true;
  }
  get complete() {
    return Boolean(
      this.current &&
        LEVELS.every((l) => this.save.entry(this.current.id, l.id).medal >= 1),
    );
  }
}
