import { SKILL_CONFIG as C, rhythmPosition } from "./skill-config.js";

export function meterView(phase, position, label, message, grade = "") {
  let good, perfect;
  if (phase === "push") {
    good = [0.5 - C.rhythm.goodHalfWidth, 0.5 + C.rhythm.goodHalfWidth];
    perfect = [
      0.5 - C.rhythm.perfectHalfWidth,
      0.5 + C.rhythm.perfectHalfWidth,
    ];
  } else if (phase === "takeoff") {
    const start = C.takeoff.armedX,
      span = C.takeoff.goodEnd + C.takeoff.meterOvershoot - start;
    good = [
      (C.takeoff.goodStart - start) / span,
      (C.takeoff.goodEnd - start) / span,
    ];
    perfect = [
      (C.takeoff.perfectStart - start) / span,
      (C.takeoff.perfectEnd - start) / span,
    ];
  } else {
    good = [
      1 - C.brace.goodMax / C.brace.meterSeconds,
      1 - C.brace.goodMin / C.brace.meterSeconds,
    ];
    perfect = [
      1 - C.brace.perfectMax / C.brace.meterSeconds,
      1 - C.brace.perfectMin / C.brace.meterSeconds,
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
    f = s.feedback?.until > world.elapsed ? s.feedback : null;
  if (world.launched) {
    const eta = s.contactETA(world);
    const early = s.braceAt !== null && s.controlScale(world) < 1;
    const message = world.landed
      ? `${s.brace} · landing angle still counts`
      : early
        ? `EARLY BRACE · air control reduced to ${Math.round(C.brace.earlyControlScale * 100)}%`
        : s.braceAt !== null
          ? "Brace committed · one brace per jump"
          : eta <= C.brace.goodMax
            ? "BRACE NOW · tap Down / S or BRACE"
            : "Rotate to wheels down; brace once near contact";
    const takeoffFeedback =
      f?.kind === "takeoff" ? `${f.grade} takeoff · ${f.detail}` : null;
    const urgent =
      early || (!world.landed && s.braceAt === null && eta <= C.brace.goodMax);
    return meterView(
      "brace",
      1 - eta / C.brace.meterSeconds,
      "03 / LANDING · " + (world.landed ? s.brace : "DOWN / S"),
      urgent ? message : takeoffFeedback || f?.detail || message,
      f?.grade || s.brace,
    );
  }
  if (world.cart.position.x >= C.takeoff.armedX) {
    const position =
      (world.cart.position.x - C.takeoff.armedX) /
      (C.takeoff.goodEnd + C.takeoff.meterOvershoot - C.takeoff.armedX);
    return meterView(
      "takeoff",
      position,
      "02 / TAKEOFF · " + (s.takeoff || "ONE PUSH"),
      (f?.kind === "takeoff" ? f.detail : null) ||
        (s.takeoff
          ? "Boost committed · get ready to rotate"
          : "Wait for the marker in green, then tap PUSH"),
      s.takeoff || "",
    );
  }
  return meterView(
    "push",
    rhythmPosition(world.elapsed),
    "01 / RHYTHM · TAP SPACE / ↑",
    f?.detail ||
      "Tap at the green centre. Release between pushes; holding gives one push.",
    f?.grade || "",
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
