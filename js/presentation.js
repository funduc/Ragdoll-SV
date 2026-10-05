import { CharacterVoices } from "./voices.js";
import { SFX_RULES } from "./sfx-config.js";
import { scoreAttempt } from "./scoring.js";
import { crashSound, landingSounds } from "./sound-events.js";
import { SYNC_CONFIG } from "./sync-config.js";
import { SynthAudio } from "./audio.js";
import { Effects } from "./effects.js";
import { State } from "./tournament.js";
import { MusicDirector, MusicPlayer } from "./music.js";
import { crowdCue, libraryTooLoud } from "./santor-tour.js";

// A read-only observer of game state and Matter collision results. No physics writes.
export class Presentation {
  constructor(root, button, onGesture = () => {}) {
    this.root = root;
    this.audio = new SynthAudio(button);
    this.voices = new CharacterVoices(this.audio);
    this.audio.onVoiceChange = active => this.onVoiceDucked?.(active);
    this.musicDirector = new MusicDirector();
    this.music = new MusicPlayer(this.audio.preferences, {
      getContext: () => this.audio.context,
      onAvailable: (value) => this.audio.setMusicAvailable(value),
    });
    this.audio.onDuck = ducked => {
      this.music.setEffectsDuck(ducked ? SFX_RULES.musicDuck : 1);
      this.onCommentaryDuck?.(ducked);
    };
    this.audio.onGesture = () => {
      this.music.retryFromGesture();
      onGesture();
    };
    this.effects = new Effects(
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
        false,
    );
    this.lastState = null;
  }
  replaceWorld(world) {
    this.world = world;
    this.launched = false;
    this.landed = false;
    this.crashed = false;
    this.shushed = false;
    this.lostParts = 0;
    this.nextImpact = 0;
    this.skillSerial = 0;
    this.soundEvents = new Set();
    this.perfectStreak = 0;
    this.flipCount = 0;
    this.riderAirborne = false;
    this.headFirst = null;
    this.effects.clear();
    this.audio.resetAttempt();
    this.voices?.reset();
  }
  state(t) {
    this.music.setTrack(this.musicDirector.scene(t));
    this.root.dataset.round = t.round;
    this.root.dataset.broadcast =
      t.state === State.FINAL
        ? "maximum"
        : t.round === "championship"
          ? t.turn
            ? "overdrive"
            : "final"
          : "normal";
    if (this.lastState === t.state) return;
    this.lastState = t.state;
    this.voices?.state(t);
    if (t.state === State.SCOREBOARD && t.lastEliminated)
      this.audio.play("elimination");
    if (t.state === State.RESULTS && t.level?.id !== "quiet-please")
      this.audio.play(t.level?.id === "open-mic" ? crowdCue(t.lastScore) : "crowd");
    if (t.kind !== "campaign" && t.state === State.SCOREBOARD) this.audio.play("crowdCheer", "crowd");
    if (t.state === State.FINAL) {
      this.effects.victory();
      this.audio.play("finalResults", "victory");
      if (t.kind !== "campaign") this.audio.play("crowdCheer", "crowd");
    }
    if (t.state === "campaign-upgrades") this.audio.play("upgradeScreen");
    if (t.state === State.READY && t.chaos) this.audio.play("chaosRoll");
    if (t.state === State.RESULTS && t.lastMedal?.upgraded) this.audio.play("medal");
    if (t.state === State.TITLE) this.effects.clear();
  }
  observe(world) {
    if (world !== this.world) this.replaceWorld(world);
    if (world.invalid) {
      this.effects.clear();
      return;
    }
    this.voices?.observe(world);
    const once = (event, condition) => {
      if (condition && !this.soundEvents.has(event)) { this.soundEvents.add(event); this.audio.play(event); }
    };
    // Audio marks the fifth Perfect push; gameplay still requires Perfect takeoff.
    once("syncReady", world.skills.pushes.Perfect >= SYNC_CONFIG.minimumPerfectPushes);
    once("rocket-boost", world.runEffects?.rocketUsed);
    once("air-brake", world.runEffects?.brakeUsed);
    if (world.launched && this.headFirst === null) {
      const contacts = (world.engine.pairs.collisionStart || []).flatMap(pair => {
        const a = pair.bodyA.parent, b = pair.bodyB.parent;
        return world.landingSurfaces.has(a) ? [b] : world.landingSurfaces.has(b) ? [a] : [];
      }).filter(body => body === world.cart || world.wheels.includes(body) || world.rider.includes(body));
      if (contacts.length) this.headFirst = contacts.includes(world.head);
    }
    const flips = world.tricks.forward + world.tricks.backward;
    while (this.flipCount < flips) this.audio.play("flip" + Math.min(4, ++this.flipCount));
    if (world.damage.ejected) {
      const grounded = world.engine.pairs.list.some(pair => pair.isActive && (
        (world.rider.includes(pair.bodyA.parent) && world.landingSurfaces.has(pair.bodyB.parent)) ||
        (world.rider.includes(pair.bodyB.parent) && world.landingSurfaces.has(pair.bodyA.parent))));
      if (!grounded) this.riderAirborne = true;
      once("riderImpact", this.riderAirborne && grounded);
    }
    if (world.finished && !this.soundEvents.has("landingBanked")) {
      this.soundEvents.add("landingBanked");
      for (const event of landingSounds(world, scoreAttempt(world.metrics(), world.character))) this.audio.play(event);
    }
    once("wrateWarning", world.events.includes("wrateWarning"));
    const feedback = world.skills.feedback;
    if (world.course.id === "quiet-please" && libraryTooLoud(world) && !this.shushed) {
      this.shushed = true;
      this.audio.play("shush");
    }
    if (feedback && feedback.serial !== this.skillSerial) {
      this.skillSerial = feedback.serial;
      const good = ["Perfect", "Perfect Brace"].includes(feedback.grade);
      if (feedback.kind === "push") {
        this.perfectStreak = good ? this.perfectStreak + 1 : 0;
        once("onFireStreak", this.perfectStreak >= 3);
      }
      const fallback = good ? "skill-perfect" : ["Good", "Good Brace", "Braced", "Boost", "Brake", "Assist"].includes(feedback.grade) ? "skill-good" : "skill-miss";
      if (feedback.kind === "push") {
        if (good || feedback.grade === "Good") this.audio.play(
          good ? "perfectPush" : "goodPush", fallback,
          { semitones: good ? Math.min(this.perfectStreak - 1, SFX_RULES.maxPushPitchSteps) * SFX_RULES.pushPitchStep : 0 },
        );
      } else {
        this.audio.play(good && feedback.kind === "takeoff" ? "perfectTakeoff" : fallback, fallback);
      }
      if (feedback.kind === "takeoff" && good)
        this.effects.burst(
          "spark",
          world.cart.position.x,
          world.cart.position.y,
          12,
        );
    }
    if (world.launched && !this.launched) {
      this.effects.burst(
        "dust",
        world.wheels[0].position.x,
        world.wheels[0].position.y,
        14,
      );
      this.audio.play("launch");
    }
    if (world.landed && !this.landed)
      this.effects.burst("dust", world.cart.position.x, world.course.groundY - 3, 18);
    for (const pair of world.engine.pairs.collisionStart || []) {
      const a = pair.bodyA.parent,
        b = pair.bodyB.parent;
      if (
        !((a === world.cart && b.isStatic) || (b === world.cart && a.isStatic))
      )
        continue;
      const v = world.preSpeeds?.get(world.cart.id) || { x: 0, y: 0 };
      const normal = pair.collision.normal;
      const speed =
        Math.abs(v.x * normal.x + v.y * normal.y) +
        Math.abs(world.cart.angularVelocity) * 26;
      if (speed < 5 || world.elapsed < this.nextImpact) continue;
      this.nextImpact = world.elapsed + 0.18;
      const point = pair.collision.supports?.[0] || world.cart.position;
      this.effects.burst("spark", point.x, point.y, 16);
      this.audio.play("impact");
      if (speed > 9 && world.crashed) this.effects.shake();
    }
    if (world.crashed && !this.crashed) {
      // Physics has already applied this impact's breakage and ejection.
      // Play now; later bounces must not replace or repeat the crash tier.
      const tier = crashSound(world);
      this.audio.play(tier, "impact");
      if (this.headFirst === true) this.audio.play("headImpact");
      if (["crashHeavy", "crashMax"].includes(tier)) this.audio.play("carnageExplosion");
      if (world.syncSoundStep > 0 || world.tricks.bestCombo > 1) this.audio.play("syncMiss", "skill-miss");
      world.syncSoundStep = 0;
      const speed = world.preSpeeds?.get(world.head.id);
      if (!world.attached || (speed && Math.hypot(speed.x, speed.y) > 6))
        this.effects.shake();
    }
    if (world.damage.lostParts.size > this.lostParts) {
      this.effects.burst("spark", world.cart.position.x, world.cart.position.y, 24);
      this.audio.play("partLoss", "impact");
      this.lostParts = world.damage.lostParts.size;
    }
    this.launched = world.launched;
    this.landed = world.landed;
    this.crashed = world.crashed;
  }
  frame(world, active, paused, dt, gap) {
    this.audio.updateDuck();
    this.music.setPaused(paused);
    this.audio.setPaused(paused);
    this.voices?.tick();
    if (gap > 250) {
      this.effects.clear();
      this.audio.stopAll();
      this.voices?.cancel();
    }
    if (!paused) this.effects.update(dt);
    this.audio.rattle(world, active && !paused);
  }
  destroy() {
    this.voices?.destroy();
    this.music.destroy();
    this.audio.destroy();
    this.effects.clear();
  }
}
