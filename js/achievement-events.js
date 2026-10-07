import { ACHIEVEMENT_RULES } from "./achievement-config.js";
import { LEVELS } from "./campaign-levels.js";
import { OBJECTIVES, CONDITIONS } from "./run-config.js";
import { scoreBowling } from "./bowling.js";

// Read-only boundary between real gameplay and the manager's flat facts.
// Called once at the end of an attempt, after scoring/objective evaluation.
export function attemptAchievementFacts(world, score, campaign = null) {
  const objective = OBJECTIVES[world.runEffects?.objectiveId];
  const successfulLanding =
    world.landed &&
    !score.crashed &&
    ["Clean", "Scrappy"].includes(score.landingQuality);
  const pulseFinished =
    world.runEffects?.mechanicalFailureOccurred &&
    world.landed &&
    world.landingTime - world.launchTime >=
      CONDITIONS["wrate-issue"].warning + CONDITIONS["wrate-issue"].duration;
  const highJump = world.highJumpResult?.() || null;
  const bowling = scoreBowling(world.bowlingResult?.() || null);
  return {
    bowlStrike: bowling?.strike === true,
    bowlRiderStrike: bowling?.riderOnly === true,
    bowlZeroMax: bowling?.zeroAtMaxSpeed === true,
    hjCleared: highJump?.cleared === true,
    hjFosbury: highJump?.fosbury === true,
    hjFace: highJump?.face === true,
    syncCompleted: Boolean(score.sync),
    syncPerfect: score.sync?.grade === "PERFECT SYNC",
    syncBoosted: (score.sync?.reward.points || 0) > 0,
    syncAllMiss: Boolean(
      (score.sync && score.sync.perfect === 0 && score.sync.good === 0) ||
        (campaign?.levelFinished &&
          campaign?.heats?.some(
            (h) =>
              h.score.sync &&
              h.score.sync.perfect === 0 &&
              h.score.sync.good === 0,
          )),
    ),
    characterId: world.character.id,
    tourStop: campaign?.level?.chapter === "santor-on-tour",
    crashed: score.crashed === true,
    carnage: world.damage.summary()?.total ?? 0,
    levelId: campaign?.level?.id,
    riderAttached: world.attached && world.landed,
    valid: world.finished && !world.invalid,
    launched: world.launched,
    landed: world.landed,
    takeoff: score.takeoffGrade,
    brace: score.braceGrade,
    rotations: score.tricks.completedRotations,
    uniqueTricks: score.tricks.unique,
    stylePoints: score.stylePoints,
    distancePoints: score.distancePoints,
    landingPoints: score.landingPoints,
    attachmentPoints: score.attachedPoints,
    objectivePoints: score.objectivePoints ?? 0,
    targetError:
      world.landed && objective?.type === "landing-zone"
        ? Math.abs(
            world.distancePixels / 40 -
              (objective.minimum + objective.maximum) / 2,
          )
        : null,
    severeCrash: world.severeCrash === true,
    crashClass: world.crashClassification,
    cleanLanding:
      world.landed && !score.crashed && score.landingQuality === "Clean",
    successfulLanding,
    objectivePassed: campaign?.lastObjective?.passed === true,
    levelCompleted:
      campaign?.lastMedal?.medal >= 1 && campaign?.levelFinished !== false,
    condition: world.runEffects?.conditionId,
    mechanicalFailure: world.runEffects?.mechanicalFailureOccurred === true,
    mechanicalRecovered: Boolean(pulseFinished && successfulLanding),
    runwayCapReached: world.skills.runwayCapReached === true,
    lostComponents: world.damage.lostParts.size,
    lostWheels: world.damage.lostWheels.size,
    landedAfterWheelLoss: world.damage.landedAfterWheelLoss,
    conditionChanges: world.runEffects?.conditionChanges || 0,
    // Reserved telemetry for mechanics that are still unavailable.
    medalPointGap: null,
    sponsorHit: null,
  };
}
export function campaignAchievementFacts(campaign) {
  const medals = LEVELS.map(
    (l) => campaign.save.entry(campaign.current.id, l.id).medal,
  );
  return {
    characterId: campaign.current.id,
    firstLevel: medals[0] >= 1 ? 1 : 0,
    completedLevels: medals.filter((n) => n >= 1).length,
    goldLevels: medals.filter((n) => n === 3).length,
    runComplete: campaign.complete,
    upgradeCount: Object.values(campaign.runs.run?.upgrades || {}).reduce(
      (a, b) => a + b,
      0,
    ),
  };
}
// Party winners are players; the "winning jump" is each winner's best jump.
export function tournamentAchievementFacts(tournament) {
  return tournament.winners.map((player) => {
    const score = tournament.bestJumpFor(player.id)?.score;
    return {
      characterId: player.character.id,
      soleWinner: tournament.winners.length === 1,
      styleMajority: Boolean(score && score.stylePoints > score.total / 2),
    };
  });
}

// Uses the existing RAF clock; no timeout, screen auto-advance or input handling.
// Discard long frame gaps, pause while hidden/blurred, reset on leaving the card.
export class BiographyReader {
  constructor(onRead) {
    this.onRead = onRead;
    this.key = null;
    this.seconds = 0;
    this.sent = false;
  }
  tick(key, characterId, gapMs, visible) {
    if (key !== this.key) {
      this.key = key;
      this.seconds = 0;
      this.sent = false;
    }
    if (
      !key ||
      !visible ||
      !Number.isFinite(gapMs) ||
      gapMs > 250 ||
      gapMs <= 0 ||
      this.sent
    )
      return;
    this.seconds += gapMs / 1000;
    if (this.seconds + 1e-8 >= ACHIEVEMENT_RULES.biographySeconds) {
      this.sent = true;
      this.onRead({
        characterId,
        seconds: Math.max(this.seconds, ACHIEVEMENT_RULES.biographySeconds),
      });
    }
  }
}
