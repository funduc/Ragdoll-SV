import {
  SKILL_CONFIG as C,
  rhythmPosition,
  pushGrade,
  takeoffGrade,
  braceGrade,
} from "./skill-config.js";
import { meterView } from "./skill-ui.js";

// Optional interactive drills live inside Instructions, without a tournament state.
// They use the same grading functions as actual attempts and never create a world.
export class Tutorial {
  constructor() {
    this.reset();
  }
  reset() {
    this.stage = 0;
    this.elapsed = 0;
    this.result = null;
    this.complete = false;
  }
  get phase() {
    return ["push", "takeoff", "brace"][this.stage];
  }
  get position() {
    return this.stage === 0
      ? rhythmPosition(this.elapsed)
      : (this.elapsed % C.tutorialSweepSeconds) / C.tutorialSweepSeconds;
  }
  tick(dt, controls) {
    if (this.complete || this.result) return;
    this.elapsed += dt;
    if (
      (this.stage < 2 && controls.pushes) ||
      (this.stage === 2 && controls.brace)
    )
      this.act();
  }
  act() {
    if (this.complete) {
      this.reset();
      return;
    }
    if (this.result) {
      this.result = null;
      this.elapsed = 0;
      return;
    }
    const p = this.position;
    this.result =
      this.stage === 0
        ? pushGrade(p)
        : this.stage === 1
          ? takeoffGrade(
              C.takeoff.armedX +
                p *
                  (C.takeoff.goodEnd +
                    C.takeoff.meterOvershoot -
                    C.takeoff.armedX),
            )
          : braceGrade((1 - p) * C.brace.meterSeconds);
  }
  next() {
    if (!this.result) return;
    if (this.stage === 2) {
      this.complete = true;
      return;
    }
    this.stage++;
    this.result = null;
    this.elapsed = 0;
  }
  view() {
    const labels = [
      "1 / TAP PUSH ON THE BEAT",
      "2 / ONE PUSH IN THE TAKEOFF ZONE",
      "3 / TAP BRACE JUST BEFORE CONTACT",
    ];
    const help = [
      "Space / ↑ or tap PUSH. Green gives speed; spamming adds wobble.",
      "The marker is your cart. Green boosts and steadies; early wastes it, late pitches forward.",
      "Down / S or tap BRACE once. Too early weakens air control; too late gives no benefit.",
    ];
    return meterView(
      this.phase,
      this.position,
      this.complete ? "PRACTICE COMPLETE" : labels[this.stage],
      this.complete
        ? "Ready to compete? Continue with Meet the competitors."
        : help[this.stage],
      this.result || "",
    );
  }
}
export const tutorialMarkup = () =>
  '<section class="skill-tutorial" aria-label="Optional interactive controls tutorial"><p class="tiny">OPTIONAL PRACTICE · 3 SHORT DRILLS · Your tournament scores are unaffected.</p><div id="tutorial-meter" class="skill-meter"></div><div class="actions"><button type="button" class="btn secondary" data-practice="action">Tap PUSH</button><button type="button" class="btn secondary" data-practice="next" hidden>Next drill</button></div></section>';
