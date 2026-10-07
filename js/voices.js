import { PIXELS_PER_METRE } from "./scoring.js";
import { VOICE_CONFIG, VOICE_RULES } from "./voice-config.js";

// Uses the existing gesture-unlocked effects player. No physics/save writes.
export class CharacterVoices {
  constructor(audio, config = VOICE_CONFIG, random = Math.random) {
    this.audio = audio;
    this.config = config;
    this.random = random;
    this.lastClip = null;
    this.party = [];
    this.reset();
    for (const [character, clips] of Object.entries(config)) for (const clip of clips) {
      const file = character + "/" + clip.file;
      audio.pack["voice:" + file] = { files: [file], voice: true, channel: "characterVoice", volume: clip.volume ?? VOICE_RULES.volume };
    }
    this.unsubscribe = audio.preferences.subscribe(() => {
      if (!this.available()) this.cancel();
    });
  }
  available() {
    return this.audio.preferences.voices && !this.audio.muted && !this.audio.paused &&
      !this.audio.failed && !this.audio.destroyed && this.audio.preferences.effects > 0;
  }
  reset() {
    this.queue = [];
    this.used = false;
    this.heckled = false;
    this.seen = new Set();
  }
  cancel() {
    this.queue = [];
    const voice = this.audio.customVoices.get("characterVoice");
    if (voice) { voice.source.stop(); this.audio.release(voice); }
  }
  pool(character, moment) {
    const previous = this.queue.at(-1)?.file || this.lastClip;
    return (this.config[character] || []).filter(clip => clip.moments.includes(moment))
      .map(clip => character + "/" + clip.file)
      .filter(file => file !== previous && this.audio.clips.has(file));
  }
  request(character, moment, jump = true, heckle = false, listener = character) {
    if (!this.available() || (jump && (heckle ? this.heckled : this.used)) || this.queue.length >= 2) return false;
    const pool = this.pool(character, moment);
    if (!pool.length) return false;
    const file = pool[Math.floor(this.random() * pool.length)];
    if (jump) { if (heckle) this.heckled = true; else this.used = true; }
    this.queue.push({ file, speakerId: character, characterId: listener, heckle });
    this.tick();
    return true;
  }
  heckle(character) {
    const candidates = Object.keys(this.config).filter(id => id !== character && this.pool(id, "heckle").length);
    const preferred = candidates.filter(id => this.party.includes(id));
    const pool = preferred.length ? preferred : candidates;
    if (pool.length) this.request(pool[Math.floor(this.random() * pool.length)], "heckle", true, true, character);
  }
  tick() {
    if (!this.available()) { this.cancel(); return; }
    if (this.audio.customVoices.has("characterVoice") || !this.queue.length) return;
    const clip = this.queue.shift();
    if (clip.file !== this.lastClip && this.audio.play("voice:" + clip.file)) {
      this.lastClip = clip.file;
      this.onPlayed?.({ characterId: clip.characterId, speakerId: clip.speakerId, heckle: clip.heckle });
    }
  }
  observe(world) {
    const once = (name, condition, fn) => {
      if (condition && !this.seen.has(name)) { this.seen.add(name); fn(); }
    };
    const id = world.character.id;
    once("rare", world.landed || world.crashed, () => {
      if (this.random() < 1 / VOICE_RULES.rareOdds) this.request(id, "rare");
    });
    once("heavy", world.crashed && world.damage.lostParts.size >= 3, () => this.request(id, "crash-big"));
    once("crash", world.crashed, () => this.heckle(id));
    once("best", world.syncResult?.grade === "PERFECT SYNC" || world.distancePixels / PIXELS_PER_METRE >= VOICE_RULES.bestMetres, () => this.request(id, "best"));
    once("air", world.launched && !world.landed && !world.crashed &&
      (world.tricks.forward + world.tricks.backward > 0 || world.course.groundY - world.cart.position.y >= VOICE_RULES.bigAirPixels), () => this.request(id, "air"));
  }
  finish(world, score, personalBest) {
    if (personalBest || score.distanceMetres >= VOICE_RULES.bestMetres) this.request(world.character.id, "best");
    if (!score.crashed && score.landingQuality === "Clean") this.request(world.character.id, "land-clean");
  }
  state(t) {
    this.party = t.kind === "campaign" ? [] : (t.players || []).map(p => p.character.id);
    if (t.kind === "campaign") return;
    if (t.state === "ready") this.request(t.current.id, "select", false);
    if (t.state === "scoreboard") {
      for (const p of t.lastEliminatedAll?.length ? t.lastEliminatedAll : t.lastEliminated ? [t.lastEliminated] : [])
        this.request(p.character?.id, "lose", false);
    }
    if (t.state === "final-results") {
      for (const p of t.winners || []) this.request(p.character.id, "win", false);
      const last = t.standings?.at(-1)?.player;
      if (last && !t.winners.includes(last)) this.request(last.character.id, "lose", false);
    }
  }
  destroy() { this.cancel(); this.unsubscribe(); }
}
