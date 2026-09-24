import { CONDITIONS, OBJECTIVES } from "./run-config.js";

// Read-only Canvas markings. HUD and touch targets do not move with these effects.
export function drawRunMarkings(renderer, world, left, right) {
  const effects = world?.runEffects;
  if (!effects) return;
  const c = renderer.ctx,
    ground = world.course.groundY;
  if (effects.conditionId === "boost-strip") {
    const strip = CONDITIONS["boost-strip"];
    c.fillStyle = effects.boostUsed ? "#267792" : "#52cefa";
    c.fillRect(strip.start, ground - 5, strip.end - strip.start, 9);
    renderer.label(
      "BOOST STRIP +3 →",
      (strip.start + strip.end) / 2,
      ground + 58,
      12,
      "#75dfff",
      "center",
    );
  }
  if (effects.conditionId === "icy-ramp") {
    c.fillStyle = "#a5e8ef";
    c.fillRect(left, ground + 1, right - left, 3);
    c.beginPath();
    c.moveTo(world.course.rampStart, ground - 2);
    c.lineTo(world.course.rampEnd, world.course.rampTop - 2);
    c.strokeStyle = "#9ce6ff";
    c.lineWidth = 4;
    c.stroke();
  }
  const objective = OBJECTIVES[effects.objectiveId];
  if (objective?.type === "landing-zone") {
    const start = world.course.rampEnd + objective.minimum * 40,
      end = world.course.rampEnd + objective.maximum * 40;
    c.fillStyle = "#b4ef4b";
    c.fillRect(start, ground - 5, end - start, 9);
    for (const x of [start, end]) {
      c.fillRect(x, ground - 60, 3, 65);
    }
    renderer.label(
      `TARGET ${objective.minimum}–${objective.maximum} m`,
      (start + end) / 2,
      ground - 70,
      13,
      "#b4ef4b",
      "center",
    );
  }
}
