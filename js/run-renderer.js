import { CONDITIONS, OBJECTIVES } from "./run-config.js";

// Read-only Canvas markings. HUD and touch targets do not move with these effects.
export function drawRunMarkings(renderer, world, left, right) {
  const effects = world?.runEffects;
  if (world?.target) drawConcreteSlab(renderer, world);
  if (!effects) return;
  const c = renderer.ctx,
    ground = world.course.groundY;
  if (effects.conditionId === "low-gravity") {
    // Slow-drifting motes sell the reduced gravity; pure decoration.
    const t = world.elapsed;
    c.fillStyle = "#b48cff66";
    for (let i = 0; i < 26; i++) {
      const x = left + ((i * 157 + t * 18) % Math.max(1, right - left));
      const y = ground - 40 - ((i * 83 + t * (12 + (i % 5) * 4)) % 420);
      c.fillRect(x, y, 3, 3);
    }
    renderer.label(
      "LOW-G ZONE",
      world.course.rampEnd + 160,
      ground - 250,
      14,
      "#b48cff",
      "center",
    );
  }
  if (
    effects.conditionId === "tailwind" ||
    effects.conditionId === "shifting-wind"
  ) {
    const air = world.launched && !world.landed;
    const dir =
      effects.conditionId === "tailwind"
        ? 1
        : effects.shiftingDirection(world) || 1;
    // Trail the arrows beside the cart (upwind side) so they never cover the HUD.
    const x = world.cart.position.x - dir * 60,
      y = world.cart.position.y - 30;
    c.strokeStyle = air ? (dir > 0 ? "#52cefa" : "#ff852b") : "#52cefa55";
    c.lineWidth = 4;
    for (let i = -1; i <= 1; i++) {
      const ox = x - dir * 70 + i * 26 * dir,
        oy = y + i * 18;
      c.beginPath();
      c.moveTo(ox - dir * 26, oy);
      c.lineTo(ox + dir * 26, oy);
      c.lineTo(ox + dir * 14, oy - 9);
      c.moveTo(ox + dir * 26, oy);
      c.lineTo(ox + dir * 14, oy + 9);
      c.stroke();
    }
    if (air && effects.conditionId === "shifting-wind")
      renderer.label(
        dir > 0 ? "GUST →" : "← GUST",
        x - dir * 70,
        y - 34,
        14,
        dir > 0 ? "#75dfff" : "#ffad72",
        "center",
      );
  }
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

function drawConcreteSlab(renderer, world) {
  const c = renderer.ctx,
    slab = world.target,
    { min, max } = slab.bounds;
  renderer.polygon(
    slab.vertices,
    world.landedOnTarget ? "#8d9aa1" : "#6d7a82",
    "#d8e2e8",
    2,
  );
  // Aggregate speckles so it reads as concrete, not foam.
  c.fillStyle = "#4b575e";
  for (let x = min.x + 6; x < max.x - 4; x += 17)
    c.fillRect(x, min.y + 4 + ((x * 7) % 7), 3, 2);
  c.fillStyle = "#ffd166";
  c.fillRect(min.x, min.y - 70, 3, 70);
  c.fillRect(max.x - 3, min.y - 70, 3, 70);
  renderer.label(
    "CONCRETE+",
    (min.x + max.x) / 2,
    min.y - 44,
    20,
    "#ffd166",
    "center",
  );
  renderer.label(
    "SOFTNESS SOLD SEPARATELY",
    (min.x + max.x) / 2,
    min.y - 24,
    10,
    "#c9b37a",
    "center",
  );
}
