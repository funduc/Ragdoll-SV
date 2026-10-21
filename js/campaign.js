import { CHARACTERS } from "./characters.js";
import { State } from "./tournament.js";
import { assertScore } from "./scoring.js";
import { LEVELS, levelById, evaluateMedal } from "./campaign-levels.js";
import { CampaignSave } from "./campaign-save.js";
import { RunSave } from "./run-save.js";
import { LoadoutSave, slotCount } from "./loadout.js";
import { AchievementManager } from "./achievements.js";
import { evaluateObjective } from "./objectives.js";
import { tourFacts } from "./santor-tour.js";

export const CampaignState = Object.freeze({
  SELECT: "campaign-select",
  PROFILE: "campaign-profile",
  MAP: "campaign-map",
  RESET: "campaign-reset",
  NEW_RUN: "campaign-new-run",
  UPGRADES: "campaign-upgrades",
  READY: State.READY,
  ACTIVE: State.ACTIVE,
  RESULTS: State.RESULTS,
});
const S = CampaignState;
const allowed = {
  [S.SELECT]: [S.PROFILE],
  [S.PROFILE]: [S.SELECT, S.MAP, S.UPGRADES],
  [S.MAP]: [S.SELECT, S.READY, S.RESET, S.NEW_RUN],
  [S.RESET]: [S.MAP],
  [S.NEW_RUN]: [S.MAP],
  [S.UPGRADES]: [S.MAP, S.RESULTS],
  [S.READY]: [S.ACTIVE, S.MAP],
  [S.ACTIVE]: [S.RESULTS, S.READY],
  [S.RESULTS]: [S.MAP, S.UPGRADES, S.READY, S.ACTIVE],
};
export function campaignFacts(score, world, reachedRamp) {
  const zone = evaluateObjective("landing-zone", score, world);
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
    trickIds: score.tricks.details.filter((t) => t.points > 0).map((t) => t.id),
    total: score.total,
    distanceMetres: score.distanceMetres,
    noMiss:
      score.pushCounts.Miss === 0 &&
      score.pushCounts.Good + score.pushCounts.Perfect > 0,
    riderAttached: world.launched && world.landed && world.attached,
    targetHit: zone.passed,
    doubleFlip: score.tricks.details.some(t => t.id === "double" && t.points > 0),
    targetLanding: world.firstLandingPiece?.label === "CONCRETE+" && world.firstLandingOnTop && !score.crashed,
    cargoRetained: Boolean(world.cargo && !world.cargoLost),
    mechanicalFailure: world.runEffects?.mechanicalFailureOccurred === true,
    mechanicalRecovered:
      world.runEffects?.mechanicalFailureOccurred === true &&
      world.landed &&
      !score.crashed &&
      ["Clean", "Scrappy"].includes(score.landingQuality),
    runwayCapReached: world.skills.runwayCapReached,
    impactLoudness: world.impactLoudness ?? null,
    ...world.propFacts(),
    ...tourFacts(world),
  });
}
// Gauntlet totals sum existing attempt scores. No score weights or per-attempt
// thresholds change; unique tricks are a union, not the sum of repeated tricks.
export function combinedFacts(heats) {
  const facts = heats.map((h) => h.facts),
    count = (key) => facts.filter((f) => f[key]).length;
  return Object.freeze({
    finished: facts.length === 3 && facts.every((f) => f.finished),
    invalid: facts.some((f) => f.invalid),
    combinedScore: heats.reduce((n, h) => n + h.score.total, 0),
    completedJumps: count("completedJump"),
    successfulLandings: count("successfulLanding"),
    controlledLandings: count("controlledLanding"),
    doubleFlips: count("doubleFlip"),
    targetLandings: count("targetLanding"),
    ribbonCut: facts.some((f) => f.ribbonCut),
    goodBraces: count("goodBrace"),
    perfectBraces: count("perfectBrace"),
    perfectTakeoffs: count("perfectTakeoff"),
    uniqueTricks: new Set(facts.flatMap((f) => f.trickIds)).size,
    propsFallen: facts.reduce((n, f) => n + (f.propsFallen || 0), 0),
    propsPastLine: facts.reduce((n, f) => n + (f.propsPastLine || 0), 0),
    propsMoved: facts.reduce((n, f) => n + (f.propsMoved || 0), 0),
    // A quiet multi-heat goal requires every heat to have a measured landing.
    impactLoudness: facts.length && facts.every((f) => Number.isFinite(f.impactLoudness))
      ? Math.max(...facts.map((f) => f.impactLoudness)) : null,
  });
}
export class Campaign {
  constructor(save, { runs = null, loadout = null, developer = null, seedFactory } = {}) {
    this.kind = "campaign";
    this.round = "vault run";
    this.developer = developer;
    this.save = save || new CampaignSave(developer ? null : undefined);
    this.runs =
      runs ||
      new RunSave(
        this.save.storage,
        seedFactory,
        new AchievementManager(this.save.storage, { medals: this.save.data }),
      );
    this.loadout = loadout || new LoadoutSave(this.save, this.runs.run, Boolean(developer));
    this.lockedLoadout = null;
    this.state = S.SELECT;
    this.current = null;
    this.level = null;
    this.stageIndex = 0;
    this.heats = [];
    this.retryAfterReward = false;
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
      if (this.runs.run?.characterId !== this.current.id)
        this.runs.begin(this.current.id, this.developer || {});
      this.transition(S.MAP);
    } else if (this.state === S.READY) this.beginAttempt();
    else if (this.state === S.RESULTS) {
      if (!this.levelFinished) {
        this.stageIndex++;
        this.resetAttemptData();
        this.transition(S.READY);
      } else this.transition(S.MAP);
    } else if (this.state === S.RESET || this.state === S.NEW_RUN)
      this.transition(S.MAP);
    // Selection and map require an explicit choice. Reset defaults to Cancel.
  }
  changeCharacter() {
    if (![S.MAP, S.PROFILE].includes(this.state)) return false;
    this.transition(S.SELECT);
    this.level = null;
    this.stageIndex = 0;
    this.heats = [];
    this.resetAttemptData();
    return true;
  }
  isUnlocked(level) {
    return Boolean(
      this.current &&
        level &&
        (this.developer ||
          level.prerequisites.every(
            (id) => this.save.entry(this.current.id, id).medal >= 1,
          )),
    );
  }
  startLevel(id) {
    const level = levelById(id);
    if (
      this.state !== S.MAP ||
      !this.isUnlocked(level)
    )
      return false;
    this.level = level;
    this.lockedLoadout = null;
    this.stageIndex = 0;
    this.heats = [];
    this.resetAttemptData();
    this.transition(S.READY);
    return true;
  }
  backToMap() {
    if (![S.READY, S.RESULTS, S.RESET, S.NEW_RUN].includes(this.state))
      return false;
    this.lockedLoadout = null;
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
    this.runs.resetProgress();
    this.runs.begin(this.current.id, this.developer || {});
    this.level = null;
    this.stageIndex = 0;
    this.heats = [];
    this.resetAttemptData();
    this.transition(S.MAP);
    return true;
  }
  requestNewRun() {
    if (this.state !== S.MAP) return false;
    this.transition(S.NEW_RUN);
    return true;
  }
  confirmNewRun() {
    if (this.state !== S.NEW_RUN) return false;
    this.runs.begin(this.current.id, {
      ...(this.developer || {}),
      discardUnsupported: true,
    });
    this.level = null;
    this.stageIndex = 0;
    this.heats = [];
    this.resetAttemptData();
    this.transition(S.MAP);
    return true;
  }
  chooseUpgrade(id) {
    if (this.state !== S.UPGRADES || !this.runs.choose(id)) return false;
    this.finishReward();
    return true;
  }
  skipUpgrade() {
    if (this.state !== S.UPGRADES || !this.runs.skipOffer()) return false;
    this.finishReward();
    return true;
  }
  finishReward() {
    if (this.retryAfterReward) {
      this.retryAfterReward = false;
      this.transition(S.RESULTS);
      this.retryLevel();
    } else this.transition(S.MAP);
  }
  retryLevel() {
    if (this.state !== S.RESULTS) return false;
    this.stageIndex = 0;
    this.heats = [];
    this.resetAttemptData();
    this.beginAttempt();
    return true;
  }
  get attemptSpec() {
    return this.level
      ? { ...this.runs.plan(this.level.id, this.developer, this.stageIndex), upgrades: { ...this.equipped } }
      : null;
  }
  get equipped() {
    return this.lockedLoadout || (this.developer ? this.runs.run?.upgrades || {} : this.current ? this.loadout.get(this.current.id) : {});
  }
  get slots() { return this.current ? slotCount(this.save, this.current.id) : 0; }
  get garageLocked() { return this.lockedLoadout !== null; }
  get canEditLoadout() { return [S.MAP, S.READY].includes(this.state) && !this.garageLocked; }
  changeLoadout(id, delta) {
    if (!this.canEditLoadout || this.developer) return false;
    if (id === "clear") { this.loadout.clear(this.current.id); return true; }
    return this.loadout.change(this.current.id, id, delta);
  }
  beginAttempt() {
    this.lastLoadout = Object.freeze({ ...this.equipped });
    if (this.level.stages) this.lockedLoadout = this.lastLoadout;
    this.runs.startAttempt(this.lastLoadout);
    this.transition(S.ACTIVE);
  }
  get stage() {
    return this.level?.stages?.[this.stageIndex] || null;
  }
  get attemptArena() {
    return this.stage?.arena || this.level?.arena;
  }
  get levelFinished() {
    return (
      !this.level?.stages || this.heats.length === this.level.stages.length
    );
  }
  get combinedScore() {
    return this.heats.reduce((sum, h) => sum + h.score.total, 0);
  }
  get introduction() {
    return this.stage?.introduction || this.level?.john.introduction || "";
  }
  resetAttemptData() {
    this.slotUnlocked = false;
    this.reachedRamp = false;
    this.lastScore = null;
    this.lastMedal = null;
    this.lastObjective = null;
    this.newAchievement = false;
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
    if (this.level.stages)
      this.heats.push(
        Object.freeze({
          score,
          facts,
          name: this.stage.name,
          condition: this.attemptSpec.condition,
        }),
      );
    const levelFacts = this.level.stages ? combinedFacts(this.heats) : facts;
    const earned = evaluateMedal(this.level, levelFacts);
    const previousSlots = this.slots;
    this.lastScore = score;
    this.lastMedal = Object.freeze({
      ...earned,
      facts: levelFacts,
      provisional: !this.levelFinished,
      ...(this.levelFinished
        ? this.save.award(this.current.id, this.level.id, earned)
        : {
            best: this.save.entry(this.current.id, this.level.id),
            upgraded: false,
          }),
    });
    this.lastObjective = evaluateObjective(
      this.attemptSpec.objective,
      score,
      world,
    );
    this.slotUnlocked = this.slots > previousSlots;
    if (this.lastObjective?.passed)
      this.newAchievement = this.runs.achieve(
        this.current.id,
        this.lastObjective.id,
      );
    if (this.levelFinished)
      this.runs.finishLevel(
        this.level.id,
        earned.medal >= 1,
        this.level.upgradeReward,
      );
    if (this.levelFinished) this.lockedLoadout = null;
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
        LEVELS.every((l) => this.runs.run?.cleared.includes(l.id)),
    );
  }
}
