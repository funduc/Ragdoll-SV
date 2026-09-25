// Original synthesized cues. One lazy context; sound is never a gameplay dependency.
import { AudioPreferences } from "./audio-preferences.js";
export const MAX_VOICES = 24;
export class SynthAudio {
  constructor(button, env = globalThis) {
    this.env = env;
    this.button = button;
    this.context = null;
    this.attempted = false;
    this.failed = false;
    this.destroyed = false;
    this.paused = false;
    this.voices = new Set();
    this.lastCues = new Map();
    this.nextRattle = 0;
    this.preferences = new AudioPreferences(env);
    this.muted = this.preferences.muted;
    this.unsubscribe = this.preferences.subscribe(() => {
      this.muted = this.preferences.muted;
      if (this.muted || this.preferences.effects === 0) this.stopAll();
      try {
        this.setLevel();
      } catch {
        this.disable();
      }
      this.updateButton();
    });
    this.gesture = (event) => {
      if (
        event.type === "keydown" &&
        (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
      )
        return;
      this.unlock();
      this.onGesture?.();
    };
    this.click = () => this.toggle();
    this.buttonKey = (event) => {
      if (!["Enter", "Space"].includes(event.code)) return;
      event.preventDefault();
      event.stopPropagation(); // Enter on Mute must not confirm a tournament menu.
      if (!event.repeat) this.toggle();
    };
    this.buttonUp = (event) => {
      if (["Enter", "Space"].includes(event.code)) event.preventDefault();
    };
    env.addEventListener?.("pointerdown", this.gesture, {
      capture: true,
      passive: true,
    });
    env.addEventListener?.("keydown", this.gesture, true);
    button?.addEventListener("click", this.click);
    button?.addEventListener("keydown", this.buttonKey);
    button?.addEventListener("keyup", this.buttonUp);
    this.updateButton();
  }
  updateButton() {
    if (!this.button) return;
    const unavailable = this.failed && !this.musicAvailable;
    this.button.textContent = unavailable
      ? "SOUND N/A"
      : this.muted
        ? "MUTED"
        : "SOUND ON";
    this.button.disabled = unavailable;
    this.button.setAttribute("aria-pressed", String(this.muted || unavailable));
    this.button.setAttribute(
      "aria-label",
      unavailable
        ? "Audio unavailable"
        : this.muted
          ? "Unmute sound"
          : "Mute sound",
    );
  }
  setMusicAvailable(available) {
    this.musicAvailable = available;
    this.updateButton();
  }
  unlock() {
    if (this.destroyed || this.failed) return;
    try {
      if (!this.attempted) {
        this.attempted = true;
        const Context = this.env.AudioContext || this.env.webkitAudioContext;
        if (!Context) {
          this.disable();
          return;
        }
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.setLevel();
        this.noise = this.context.createBuffer(
          1,
          Math.floor(this.context.sampleRate * 0.7),
          this.context.sampleRate,
        );
        const data = this.noise.getChannelData(0);
        let seed = 43117;
        for (let i = 0; i < data.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          data[i] = seed / 2147483648 - 1;
        }
      }
      if (this.context?.state === "suspended" && !this.resuming) {
        this.resuming = Promise.resolve(this.context.resume())
          .catch(() => {
            if (!this.destroyed) this.disable();
          })
          .finally(() => {
            this.resuming = null;
          });
      }
    } catch {
      this.disable();
    }
  }
  setLevel() {
    if (!this.master) return;
    this.master.gain.setValueAtTime(
      this.muted || this.paused || this.failed
        ? 0
        : 0.28 * this.preferences.effects,
      this.context.currentTime,
    );
  }
  toggle() {
    if ((this.failed && !this.musicAvailable) || this.destroyed) return;
    this.preferences.setMuted(!this.muted);
    if (this.muted) this.stopAll();
    else this.unlock();
    try {
      this.setLevel();
    } catch {
      this.disable();
    }
    this.updateButton();
    if (!this.muted) this.play("click");
  }
  setPaused(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) this.stopAll();
    try {
      this.setLevel();
    } catch {
      this.disable();
    }
  }
  voice(type, frequency, delay, duration, volume, endFrequency = frequency) {
    if (this.voices.size >= MAX_VOICES) return;
    const ctx = this.context,
      when = ctx.currentTime + delay;
    const source =
      type === "noise" ? ctx.createBufferSource() : ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = type === "noise" ? ctx.createBiquadFilter() : null;
    const voice = { source, gain, filter };
    this.voices.add(voice);
    if (filter) {
      source.buffer = this.noise;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(frequency, when);
      filter.Q.setValueAtTime(0.6, when);
      source.connect(filter);
      filter.connect(gain);
    } else {
      source.type = type;
      source.frequency.setValueAtTime(frequency, when);
      source.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        when + duration,
      );
      source.connect(gain);
    }
    gain.connect(this.master);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(
      Math.min(0.22, volume),
      when + Math.min(0.03, duration / 4),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.onended = () => this.release(voice);
    source.start(when);
    source.stop(when + duration + 0.015);
  }
  release(voice) {
    voice.source.onended = null;
    for (const node of [voice.source, voice.gain, voice.filter]) {
      try {
        node?.disconnect();
      } catch {}
    }
    this.voices.delete(voice);
  }
  play(cue) {
    if (
      this.destroyed ||
      this.failed ||
      this.muted ||
      this.preferences.effects === 0 ||
      this.paused ||
      this.context?.state !== "running"
    )
      return;
    const now = this.context.currentTime;
    if (now - (this.lastCues.get(cue) ?? -Infinity) < 0.07) return;
    this.lastCues.set(cue, now);
    try {
      switch (cue) {
        case "sync-beat":
          this.voice("triangle", 700, 0, 0.06, 0.12, 240);
          break;
        case "sync-drop":
          this.voice("sine", 150, 0, 0.2, 0.18, 40);
          this.voice("triangle", 880, 0, 0.18, 0.1, 1760);
          break;
        case "click":
          this.voice("square", 520, 0, 0.045, 0.055, 760);
          break;
        case "skill-perfect":
          this.voice("triangle", 880, 0, 0.12, 0.12, 1320);
          this.voice("sine", 1320, 0.07, 0.12, 0.09, 1760);
          break;
        case "skill-good":
          this.voice("triangle", 620, 0, 0.09, 0.1, 880);
          break;
        case "skill-miss":
          this.voice("triangle", 220, 0, 0.11, 0.09, 120);
          break;
        case "rattle":
          this.voice("noise", 1800, 0, 0.035, 0.075);
          break;
        case "launch":
          this.voice("sine", 260, 0, 0.24, 0.14, 1050);
          this.voice("noise", 1100, 0, 0.16, 0.11);
          break;
        case "impact":
          this.voice("sine", 95, 0, 0.2, 0.2, 35);
          this.voice("noise", 500, 0, 0.18, 0.18);
          break;
        case "crowd":
          this.voice("noise", 900, 0, 0.62, 0.18);
          this.voice("sine", 1150, 0.09, 0.32, 0.035, 1350);
          break;
        case "elimination":
          [330, 277, 196].forEach((f, i) =>
            this.voice("triangle", f, i * 0.16, 0.22, 0.13),
          );
          break;
        case "victory":
          [392, 523, 659, 784, 659, 1047].forEach((f, i) =>
            this.voice("square", f, i * 0.14, 0.19, 0.06),
          );
          [262, 392, 523].forEach((f) =>
            this.voice("triangle", f, 0.83, 0.5, 0.065),
          );
          break;
      }
    } catch {
      this.disable();
    }
  }
  rattle(world, active) {
    if (
      !active ||
      world.invalid ||
      (world.launched && !world.landed) ||
      world.cart.speed < 0.8
    )
      return;
    if (world.elapsed >= this.nextRattle) {
      this.play("rattle");
      this.nextRattle =
        world.elapsed + Math.max(0.12, 0.25 - world.cart.speed * 0.006);
    }
  }
  stopAll() {
    for (const voice of [...this.voices]) {
      try {
        voice.source.stop();
      } catch {}
      this.release(voice);
    }
  }
  resetAttempt() {
    this.stopAll();
    this.nextRattle = 0;
    this.lastCues.clear();
  }
  disable() {
    this.failed = true;
    this.stopAll();
    try {
      this.setLevel();
    } catch {}
    this.updateButton();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.stopAll();
    this.env.removeEventListener?.("pointerdown", this.gesture, true);
    this.env.removeEventListener?.("keydown", this.gesture, true);
    this.button?.removeEventListener("click", this.click);
    this.button?.removeEventListener("keydown", this.buttonKey);
    this.button?.removeEventListener("keyup", this.buttonUp);
    try {
      this.master?.disconnect();
      Promise.resolve(this.context?.close()).catch(() => {});
    } catch {}
  }
}
