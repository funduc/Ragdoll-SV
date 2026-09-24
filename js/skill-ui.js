import { SKILL_CONFIG as C, rhythmPosition } from "./skill-config.js";

export function meterView(
  phase,
  position,
  label,
  message,
  grade = "",
  config = C,
) {
  let good, perfect;
  if (phase === "push") {
    good = [
      0.5 - config.rhythm.goodHalfWidth,
      0.5 + config.rhythm.goodHalfWidth,
    ];
    perfect = [
      0.5 - config.rhythm.perfectHalfWidth,
      0.5 + config.rhythm.perfectHalfWidth,
    ];
  } else if (phase === "takeoff") {
    const start = config.takeoff.armedX,
      span = config.takeoff.goodEnd + config.takeoff.meterOvershoot - start;
    good = [
      (config.takeoff.goodStart - start) / span,
      (config.takeoff.goodEnd - start) / span,
    ];
    perfect = [
      (config.takeoff.perfectStart - start) / span,
      (config.takeoff.perfectEnd - start) / span,
    ];
  } else {
    good = [
      1 - config.brace.goodMax / config.brace.meterSeconds,
      1 - config.brace.goodMin / config.brace.meterSeconds,
    ];
    perfect = [
      1 - config.brace.perfectMax / config.brace.meterSeconds,
      1 - config.brace.perfectMin / config.brace.meterSeconds,
    ];
  }
  return {
    phase,
    position: Math.max(0, Math.min(1, position)),
    label,
    message,
    grade,
    good,
    perfect,
  };
}
export function worldSkillView(world) {
  const s = world.skills,
    config = s.config,
    f = s.feedback?.until > world.elapsed ? s.feedback : null;
  if (world.launched) {
    const eta = s.contactETA(world);
    const early = s.braceAt !== null && s.controlScale(world) < 1;
    const message = world.landed
      ? `${s.brace} · landing angle still counts`
      : early
        ? `EARLY BRACE · air control reduced to ${Math.round(config.brace.earlyControlScale * 100)}%`
        : s.braceAt !== null
          ? "Brace committed · one brace per jump"
          : eta <= config.brace.goodMax
            ? "BRACE NOW · tap Down / S or BRACE"
            : "Rotate to wheels down; brace once near contact";
    const takeoffFeedback =
      f?.kind === "takeoff" ? `${f.grade} takeoff · ${f.detail}` : null;
    const urgent =
      early ||
      (!world.landed && s.braceAt === null && eta <= config.brace.goodMax);
    return meterView(
      "brace",
      1 - eta / config.brace.meterSeconds,
      "03 / LANDING · " + (world.landed ? s.brace : "DOWN / S"),
      urgent ? message : takeoffFeedback || f?.detail || message,
      f?.grade || s.brace,
      config,
    );
  }
  if (world.cart.position.x >= config.takeoff.armedX) {
    const position =
      (world.cart.position.x - config.takeoff.armedX) /
      (config.takeoff.goodEnd +
        config.takeoff.meterOvershoot -
        config.takeoff.armedX);
    return meterView(
      "takeoff",
      position,
      "02 / TAKEOFF · " + (s.takeoff || "ONE PUSH"),
      (f?.kind === "takeoff" ? f.detail : null) ||
        (s.takeoff
          ? "Boost committed · get ready to rotate"
          : "Wait for the marker in green, then tap PUSH"),
      s.takeoff || "",
      config,
    );
  }
  return meterView(
    "push",
    rhythmPosition(world.elapsed),
    "01 / RHYTHM · TAP SPACE / ↑",
    f?.detail ||
      "Tap at the green centre. Release between pushes; holding gives one push.",
    f?.grade || "",
    config,
  );
}
export class SkillMeter {
  constructor(element) {
    this.element = element;
    element.innerHTML =
      '<div class="skill-heading"><b data-skill-label></b><strong data-skill-grade aria-live="polite"></strong></div><div class="skill-track" role="meter" aria-label="Timing indicator" aria-valuemin="0" aria-valuemax="100"><span class="skill-good"></span><span class="skill-perfect"></span><i class="skill-marker"></i></div><div class="skill-legend"><span>MISS / EARLY</span><span>GOOD</span><b>PERFECT</b><span>GOOD</span><span>MISS / LATE</span></div><p class="skill-message" data-skill-message></p>';
    this.label = element.querySelector("[data-skill-label]");
    this.grade = element.querySelector("[data-skill-grade]");
    this.message = element.querySelector("[data-skill-message]");
    this.track = element.querySelector(".skill-track");
    this.marker = element.querySelector(".skill-marker");
  }
  update(view) {
    for (const [element, text] of [
      [this.label, view.label],
      [this.grade, view.grade],
      [this.message, view.message],
    ])
      if (element.textContent !== text) element.textContent = text;
    this.element.dataset.phase = view.phase;
    this.element.dataset.grade = view.grade;
    this.marker.style.left = `${view.position * 100}%`;
    this.track.setAttribute(
      "aria-valuenow",
      String(Math.round(view.position * 100)),
    );
    for (const zone of ["good", "perfect"]) {
      const el = this.element.querySelector(".skill-" + zone),
        range = view[zone];
      el.style.left = `${range[0] * 100}%`;
      el.style.width = `${(range[1] - range[0]) * 100}%`;
    }
  }
}
