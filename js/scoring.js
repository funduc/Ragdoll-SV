export const PIXELS_PER_METRE = 40;
export const normalAngle = (angle) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

// This ceiling is far beyond any reachable course measurement. It prevents
// overflow if a corrupt measurement or edited character value reaches scoring.
const nonNegativeFinite = (value) =>
  Number.isFinite(value) ? Math.max(0, Math.min(value, 1_000_000)) : 0;

export function scoreAttempt(metrics, character) {
  const distancePixels = nonNegativeFinite(metrics.distancePixels);
  const airRotation = nonNegativeFinite(metrics.airRotation);
  const styleMultiplier = nonNegativeFinite(character.styleMultiplier);
  const stability = nonNegativeFinite(character.landingStability);
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
  const quarterTurns = Math.min(
    12,
    Math.floor((airRotation + 0.00001) / (Math.PI / 2)),
  );
  const stylePoints = Math.round(quarterTurns * 60 * styleMultiplier);
  let landingQuality = "No landing",
    landingPoints = 0;
  if (validLanding) {
    const angle = Math.abs(normalAngle(landingAngle));
    if (metrics.crashed) landingQuality = "Crash";
    else if (
      angle <= 0.42 * stability &&
      metrics.landingSpeed < 12 * stability
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
  return Object.freeze({
    distanceMetres,
    distancePoints,
    quarterTurns,
    stylePoints,
    landingQuality,
    landingPoints,
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
