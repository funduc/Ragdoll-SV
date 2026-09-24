import { OBJECTIVES } from "./run-config.js";
import { TRICK_CONFIG } from "./trick-config.js";

// Evaluates final measurements only: no timers, awards, or physics mutations.
// Named tricks use recognized IDs, not angle estimates or commentary captions.
export function evaluateObjective(id, score, world) {
  const objective = OBJECTIVES[id];
  if (!objective) return null;
  let passed = false,
    measured = "";
  const landed = world.launched && world.landed;
  const details = score.tricks.details;
  switch (objective.type) {
    case "distance":
      passed = world.launched && score.distanceMetres >= objective.metres;
      measured = `${score.distanceMetres.toFixed(1)} m / ${objective.metres.toFixed(1)} m`;
      break;
    case "named-trick":
      passed = details.some(
        (trick) => trick.id === objective.trick && trick.points > 0,
      );
      measured = passed
        ? `${TRICK_CONFIG.tricks[objective.trick].name} recognized`
        : `No recognized ${TRICK_CONFIG.tricks[objective.trick].name}`;
      break;
    case "unique-tricks":
      passed = score.tricks.unique >= objective.count;
      measured = `${score.tricks.unique} / ${objective.count} different tricks`;
      break;
    case "attached":
      passed = landed && world.attached;
      measured = !landed
        ? "No completed landing"
        : world.attached
          ? "Rider attached at finish"
          : "Rider detached";
      break;
    case "brace":
      passed = landed && score.braceGrade === objective.grade;
      measured = score.braceGrade;
      break;
    case "landing-zone": {
      const metres = world.distancePixels / 40;
      passed =
        landed &&
        Number.isFinite(metres) &&
        metres >= objective.minimum &&
        metres <= objective.maximum;
      measured =
        landed && Number.isFinite(metres)
          ? `First contact ${metres.toFixed(2)} m · target ${objective.minimum}–${objective.maximum} m`
          : "No first ground contact";
      break;
    }
    case "style-multiplier": {
      const factor =
        score.tricks.characterMultiplier * score.tricks.landingMultiplier;
      passed =
        score.stylePoints > 0 &&
        Number.isFinite(factor) &&
        factor > objective.multiplier;
      measured = `Final factor ×${factor.toFixed(2)} · must exceed ×${objective.multiplier.toFixed(2)} with a scored trick`;
      break;
    }
    case "no-miss":
      passed =
        landed &&
        score.pushCounts.Perfect + score.pushCounts.Good > 0 &&
        score.pushCounts.Miss === 0;
      measured = `${score.pushCounts.Miss} Missed rhythm pushes${!landed ? " · no completed jump" : ""}`;
      break;
  }
  return Object.freeze({
    id,
    passed: Boolean(world.finished && !world.invalid && passed),
    measured,
  });
}
