export const PIXELS_PER_METRE = 40;
import { braceTolerance } from "./skill-config.js";
import { scoreTricks } from "./tricks.js";
export const normalAngle = (angle) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

// This ceiling is far beyond any reachable course measurement. It prevents
// overflow if a corrupt measurement or edited character value reaches scoring.
const nonNegativeFinite = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.min(value, 1_000_000)) : 0;

export function scoreAttempt(metrics, character) {
  const distancePixels = nonNegativeFinite(metrics.distancePixels);
  const airRotation = nonNegativeFinite(metrics.airRotation);
  const stability = nonNegativeFinite(character.landingStability);
  const takeoffGrade = ["Perfect", "Good", "Early", "Late"].includes(
    metrics.takeoffGrade,
  )
    ? metrics.takeoffGrade
    : "Late";
  const braceGrade = [
    "Perfect Brace",
    "Good Brace",
    "Early",
    "Late",
    "Unbraced",
  ].includes(metrics.braceGrade)
    ? metrics.braceGrade
    : "Unbraced";
  const tolerance = braceTolerance(braceGrade);
  const validLanding =
    metrics.landed &&
    Number.isFinite(metrics.landingAngle) &&
    Number.isFinite(metrics.landingSpeed) &&
    metrics.landingSpeed >= 0;
  const landingAngle = Number.isFinite(metrics.landingAngle)
    ? metrics.landingAngle
    : 0;
  const distanceMetres = Math.max(
    0,
    Math.floor((distancePixels / PIXELS_PER_METRE) * 10) / 10,
  );
  const distancePoints = Math.round(distanceMetres * 10);
  let landingQuality = "No landing",
    landingPoints = 0;
  if (validLanding) {
    const angle = Math.abs(normalAngle(landingAngle));
    if (metrics.crashed) landingQuality = "Crash";
    else if (
      angle <= 0.42 * stability &&
      metrics.landingSpeed < 12 * stability * tolerance
    ) {
      landingQuality = "Clean";
      landingPoints = 150;
    } else if (angle <= 0.9 * stability) {
      landingQuality = "Scrappy";
      landingPoints = 75;
    } else landingQuality = "Rough";
  }
  const attachedPoints =
    metrics.launched && validLanding && metrics.attached ? 100 : 0;
  const tricks = scoreTricks(
    metrics.trickSummary,
    character,
    metrics.crashed ? "Crash" : landingQuality,
  );
  const stylePoints = tricks.points;
  return Object.freeze({
    distanceMetres,
    distancePoints,
    quarterTurns: tricks.completedRotations * 4,
    tricks,
    stylePoints,
    landingQuality,
    landingPoints,
    takeoffGrade,
    braceGrade,
    impactTolerance: tolerance,
    braceLeadMs: Number.isFinite(metrics.braceLeadMs)
      ? Math.round(nonNegativeFinite(metrics.braceLeadMs))
      : null,
    takeoffBonus: nonNegativeFinite(metrics.takeoffBonus),
    pushCounts: Object.freeze(
      Object.fromEntries(
        ["Perfect", "Good", "Miss"].map((grade) => [
          grade,
          Math.floor(nonNegativeFinite(metrics.pushCounts?.[grade])),
        ]),
      ),
    ),
    attachedPoints,
    total: distancePoints + stylePoints + landingPoints + attachedPoints,
    airDegrees: Math.round((airRotation * 180) / Math.PI),
    attached: metrics.attached,
    reason: metrics.reason,
    crashed: metrics.crashed,
    landingAngle: Math.round(
      (Math.abs(normalAngle(landingAngle)) * 180) / Math.PI,
    ),
  });
}

export function assertScore(score) {
  const fields = [
    "distancePoints",
    "stylePoints",
    "landingPoints",
    "attachedPoints",
    "total",
    "quarterTurns",
    "airDegrees",
    "landingAngle",
  ];
  if (
    !score ||
    !fields.every(
      (field) => Number.isSafeInteger(score[field]) && score[field] >= 0,
    ) ||
    !Number.isFinite(score.distanceMetres) ||
    score.distanceMetres < 0 ||
    score.total !==
      score.distancePoints +
        score.stylePoints +
        score.landingPoints +
        score.attachedPoints
  ) {
    throw new TypeError(
      "Attempt score must contain finite, nonnegative components and their exact total.",
    );
  }
}

// An exact qualifying tie is resolved reproducibly, without silently awarding an extra jump.
export function rankQualifiers(characters, scores) {
  return characters
    .map((character, index) => ({
      character,
      index,
      score: scores[character.id],
    }))
    .sort(
      (a, b) =>
        b.score.total - a.score.total ||
        b.score.distanceMetres - a.score.distanceMetres ||
        a.index - b.index,
    )
    .map((entry) => entry.character);
}
export function championshipWinners(finalists, scores) {
  const best = Math.max(
    ...finalists.map((character) => scores[character.id].total),
  );
  return finalists.filter((character) => scores[character.id].total === best);
}
