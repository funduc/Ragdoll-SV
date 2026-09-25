import { SYNC_CONFIG as C, syncResult, syncReward } from "./sync-config.js";
// No DOM, audio timing, timers, listeners or physics steps. Input timestamps are
// the same internal clock on early and late sides of the timing line.
export class SyncSequence {
  constructor(characterId) {
    this.characterId = characterId;
    const c = C.characters[characterId] || C.characters.jake;
    this.perfectWindow = C.perfectWindow * c.windows;
    this.goodWindow = C.goodWindow * c.windows;
    this.notes = c.pattern.map((lane, i) => ({
      lane,
      at: C.firstBeat + i * C.spacing * c.spacing,
      grade: null,
      beat: false,
    }));
    this.time = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.extra = 0;
    this.feedback = "Match each arrow at the green line. Release between taps.";
    this.serial = 0;
    this.beats = [];
    this.result = null;
    this.end = this.notes.at(-1).at + this.goodWindow;
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > C.maximumFrameGap) return;
    this.time += dt;
    for (const note of this.notes) {
      if (!note.beat && this.time >= note.at) {
        note.beat = true;
        this.beats.push(note.lane);
      }
      if (!note.grade && this.time > note.at + this.goodWindow + 1e-9)
        this.judge(note, "Miss");
    }
    if (this.time > this.end + 1e-9 && !this.result)
      this.result = syncResult(
        this.notes.filter((n) => n.grade === "Perfect").length,
        this.notes.filter((n) => n.grade === "Good").length,
        this.extra,
      );
  }
  hit(lane) {
    if (this.result || !Number.isInteger(lane) || lane < 0 || lane > 3) return;
    const note = this.notes
      .filter(
        (n) => !n.grade && Math.abs(n.at - this.time) <= this.goodWindow + 1e-9,
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
        : Math.abs(note.at - this.time) <= this.perfectWindow + 1e-9
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
    return Boolean(this.result && this.time >= this.end + C.resultSeconds);
  }
  get charge() {
    return (
      (this.notes.filter((n) => n.grade === "Perfect").length +
        C.goodCredit * this.notes.filter((n) => n.grade === "Good").length) /
      C.notes
    );
  }
}
// Called only at the existing launch transition, after normal takeoff timing.
export function applySyncLaunch(world) {
  if (!world.syncResult || world.syncApplied) return;
  world.syncApplied = true;
  const reward = syncReward(world.syncResult, world.character.id);
  if (reward.speed === 1) return;
  const { Body } = world.M,
    v = Body.getVelocity(world.cart);
  const dx = Math.max(0, Math.min(C.maximumSpeed, v.x * reward.speed) - v.x);
  const upward = Math.max(0, -v.y);
  const dy = -Math.max(
    0,
    Math.min(C.maximumUpwardSpeed, upward * Math.sqrt(reward.height)) - upward,
  );
  // Preserve relative motion and joint geometry, including carried cargo.
  const bodies = [...world.dynamic, ...(world.cargo ? [world.cargo] : [])];
  for (const body of new Set(bodies)) {
    const speed = Body.getVelocity(body);
    Body.setVelocity(body, { x: speed.x + dx, y: speed.y + dy });
  }
  Body.setAngularVelocity(
    world.cart,
    Math.max(
      -C.maximumSpin,
      Math.min(
        C.maximumSpin,
        world.cart.angularVelocity * reward.damping + reward.kick,
      ),
    ),
  );
}
