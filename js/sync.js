import { SYNC_CONFIG as C, syncResult } from "./sync-config.js";
// No DOM, audio timing, timers, listeners or physics steps. Input timestamps are
// the same internal clock on early and late sides of the timing line.
export class SyncSequence {
  constructor(characterId, pattern = C.characters[characterId]?.patterns[0].slice(0, 3) || C.characters.jake.patterns[0].slice(0, 3)) {
    this.characterId = characterId;
    const c = C.characters[characterId] || C.characters.jake;
    this.perfectWindow = C.perfectWindow * c.windows;
    this.goodWindow = C.goodWindow * c.windows;
    this.introStart = C.easeInSeconds;
    this.countInStart = this.introStart + C.introSeconds;
    this.notesStart = this.countInStart + C.countInSeconds;
    this.countIn = Array.from({ length: C.countInTicks }, (_, i) => ({
      at: this.countInStart + i * C.countInSeconds / C.countInTicks, played: false,
    }));
    this.notes = pattern.map((lane, i) => ({
      lane,
      at: this.notesStart + C.firstBeat + i * C.spacing * c.spacing,
      perfectWindow: (i === 0 ? C.firstPerfectWindow : C.perfectWindow) * c.windows,
      goodWindow: (i === 0 ? C.firstGoodWindow : C.goodWindow) * c.windows,
      grade: null,
      beat: false,
    }));
    this.time = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.extra = 0;
    this.feedback = "Tap each arrow on the beat!";
    this.serial = 0;
    this.beats = [];
    this.result = null;
    this.end = this.notes.at(-1).at + this.notes.at(-1).goodWindow;
    this.resultEnd = this.end + C.resultSeconds;
    this.duration = this.resultEnd + C.easeOutSeconds;
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > C.maximumFrameGap) return;
    const previous = this.physicsTime(this.time);
    this.time += dt;
    for (const beat of this.countIn) {
      if (!beat.played && this.time >= beat.at) { beat.played = true; this.beats.push("count-in"); }
    }
    for (const note of this.notes) {
      if (!note.beat && this.time >= note.at) {
        note.beat = true;
        this.beats.push(note.lane);
      }
      if (!note.grade && this.time > note.at + note.goodWindow + 1e-9)
        this.judge(note, "Miss");
    }
    if (this.time > this.end + 1e-9 && !this.result)
      this.result = syncResult(
        this.notes.filter((n) => n.grade === "Perfect").length,
        this.notes.filter((n) => n.grade === "Good").length,
        this.extra,
        this.notes.length,
      );
    return this.physicsTime(this.time) - previous;
  }
  hit(lane) {
    if (this.time < this.notes[0].at - this.notes[0].goodWindow || this.result || !Number.isInteger(lane) || lane < 0 || lane > 3) return;
    const note = this.notes
      .filter(
        (n) => !n.grade && Math.abs(n.at - this.time) <= n.goodWindow + 1e-9,
      )
      .sort(
        (a, b) => Math.abs(a.at - this.time) - Math.abs(b.at - this.time),
      )[0];
    if (!note) {
      this.extra = Math.min(C.maximumExtraMisses, this.extra + 1);
      this.judge(null, "Miss");
      return;
    }
    this.judge(
      note,
      note.lane !== lane
        ? "Miss"
        : Math.abs(note.at - this.time) <= note.perfectWindow + 1e-9
          ? "Perfect"
          : "Good",
    );
  }
  judge(note, grade) {
    if (note) note.grade = grade;
    this.combo = grade === "Miss" ? 0 : this.combo + 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.feedback = grade;
    this.serial++;
  }
  get done() {
    return Boolean(this.result && this.time >= this.duration);
  }
  get phase() {
    if (this.time < this.introStart) return "enter";
    if (this.time < this.countInStart) return "intro";
    if (this.time < this.notesStart) return "count-in";
    if (this.time <= this.end) return "notes";
    return this.time < this.resultEnd ? "result" : "exit";
  }
  get timeScale() {
    if (this.time < this.introStart)
      return C.timeScale + (1 - C.timeScale) * (1 - this.time / C.easeInSeconds) ** C.easeInPower;
    if (this.time <= this.resultEnd) return C.timeScale;
    const u = Math.min(1, (this.time - this.resultEnd) / C.easeOutSeconds);
    return C.timeScale + (1 - C.timeScale) * (3 * u * u - 2 * u * u * u);
  }
  // Exact integral of the speed envelope. Budgeting and rendering frames use
  // the same clock, so a low frame rate cannot consume extra landing time.
  physicsTime(time) {
    const entry = Math.min(time, C.easeInSeconds);
    let total = C.timeScale * entry + (1 - C.timeScale) * C.easeInSeconds / (C.easeInPower + 1) *
      (1 - (1 - entry / C.easeInSeconds) ** (C.easeInPower + 1));
    total += Math.max(0, Math.min(time, this.resultEnd) - C.easeInSeconds) * C.timeScale;
    const u = Math.max(0, Math.min(1, (time - this.resultEnd) / C.easeOutSeconds));
    total += C.easeOutSeconds * (C.timeScale * u + (1 - C.timeScale) * (u ** 3 - u ** 4 / 2));
    return total + Math.max(0, time - this.duration);
  }
  get charge() {
    return (
      (this.notes.filter((n) => n.grade === "Perfect").length +
        C.goodCredit * this.notes.filter((n) => n.grade === "Good").length) /
      this.notes.length
    );
  }
}
// Conservative time to any floor, raised surface, prop or obstacle ahead.
// Uses the highest reachable surface, including pits' rim height, so a gap
// cannot falsely promise infinite recovery time. No physics is simulated here.
export function syncLandingETA(world) {
  if (!world.launched || world.landed || world.crashed || world.finished) return 0;
  const bottom = Math.max(...world.dynamic.map((body) => body.bounds.max.y));
  const velocity = world.M.Body.getVelocity(world.cart), vx = velocity.x * 60, vy = velocity.y * 60;
  const gravity = world.engine.gravity.y * world.engine.gravity.scale * 1e6;
  const fall = (surface) => {
    const height = surface - bottom;
    if (height <= 0) return 0;
    return (-vy + Math.sqrt(vy * vy + 2 * gravity * height)) / gravity;
  };
  let eta = fall(world.course.groundY);
  const x = world.cart.position.x, reach = x + vx * eta;
  for (const body of [...world.coursePieces, ...world.looseProps, ...(world.bar ? [world.bar] : [])]) {
    if (body.bounds.max.x < Math.min(x, reach) - 120 || body.bounds.min.x > Math.max(x, reach) + 120) continue;
    eta = Math.min(eta, fall(body.bounds.min.y));
  }
  return eta;
}

export function syncMoment(world, { hard = false, lastPattern = "", serial = 0 } = {}) {
  if (world.syncTriggered || world.syncMissedAt !== undefined ||
      world.skills.takeoff !== "Perfect" || world.skills.pushes.Perfect < C.minimumPerfectPushes) return null;
  world.syncReady = true;
  if (!world.launched) return null;
  const gravity = world.engine.gravity.y * world.engine.gravity.scale * 1e6;
  const vy = world.M.Body.getVelocity(world.cart).y * 60;
  // Once the apex window opens, keep the earned opportunity through a flip.
  if (vy < -gravity * C.apexLead && !world.syncWindowOpen) return null;
  world.syncWindowOpen = true;
  const eta = syncLandingETA(world);
  const c = C.characters[world.character.id];
  let count = eta > 1.6 ? 5 : hard || eta > 1.3 ? 4 : 3;
  for (; count >= 3; count--) {
    const pool = c.patterns.map((p) => p.slice(0, count)).filter((p) => p.join("") !== lastPattern);
    const pattern = pool[serial % pool.length];
    const sequence = new SyncSequence(world.character.id, pattern);
    if (eta >= C.recoverySeconds + C.safetyMargin + sequence.physicsTime(sequence.duration)) {
      // No angle or input gate: small steering and a tilted cart remain eligible.
      return Math.abs(world.cart.angularVelocity) <= C.maximumSpin && world.attached ? sequence : null;
    }
  }
  world.syncReady = false;
  world.syncMissedAt = world.elapsed;
  return null;
}

export function syncStatus(world) {
  if (world.syncTriggered) return "";
  if (world.syncMissedAt !== undefined)
    return world.elapsed - world.syncMissedAt < C.missedSeconds ? "SYNC MISSED: NOT ENOUGH AIR" : "";
  return world.syncReady ? "SYNC READY" : "";
}
