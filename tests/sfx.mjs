import { crashSound, landingSounds, syncSounds } from "../js/sound-events.js";
import { SyncSequence } from "../js/sync.js";
import { Records, RECORDS_SAVE_KEY } from "../js/records.js";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { Presentation } from "../js/presentation.js";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { chapterControls } from "./chapter-helpers.mjs";
import assert from "node:assert/strict";
import { audioDouble } from "./fake-audio.mjs";
import { SynthAudio } from "../js/audio.js";
import { SFX_CONFIG, SFX_RULES } from "../js/sfx-config.js";
import { MusicPlayer } from "../js/music.js";
import { UI } from "../js/ui.js";
let time = 0;
class Context extends audioDouble(() => time) {
  async decodeAudioData(data) { if (data === "bad") throw Error("unsupported"); return { duration: data === "long" ? 30 : 3 }; }
  createGain() { const gain = super.createGain(); gain.gain.setValueAtTime = value => { gain.value = value; }; return gain; }
}
const env = new EventTarget(), fetched = [];
env.AudioContext = Context;
env.fetch = async url => { fetched.push(String(url)); return { ok: !String(url).includes("missing"), arrayBuffer: async () => String(url).includes("bad") ? "bad" : String(url).includes("long") ? "long" : "good" }; };
const audio = new SynthAudio(null, env, {
  crash: { files: ["a.mp3", "b.ogg"], volume: .6, duck: true },
  rare: { files: ["a.mp3"], rarity: 20 },
  absent: { files: ["missing.mp3", "bad.ogg", "long.mp3", "../escape.mp3"] },
});
const ducks = []; audio.onDuck = value => ducks.push(value);
audio.play("crash", "impact"); assert.equal(fetched.length, 0); assert.equal(audio.voices.size, 0);
env.dispatchEvent(new Event("pointerdown")); await audio.loadingPack;
assert.equal(fetched.length, 5); assert.equal(audio.clips.size, 2);
assert.ok(fetched.every(url => url.includes("/assets/audio/sfx/")));
env.dispatchEvent(new Event("pointerdown")); assert.equal(fetched.length, 5, "load once per session");
const oldRandom = Math.random;
try {
  Math.random = () => 0;
  audio.play("crash", "impact"); const first = audio.customVoices.get("crash");
  assert.equal(first.gain.value, .6); assert.equal(first.source.buffer, audio.clips.get("a.mp3"));
  Math.random = () => .99;
  audio.play("crash", "impact"); const second = audio.customVoices.get("crash");
  assert.notEqual(first, second); assert.equal(first.source.onended, null); assert.equal(first.source.stopTime, time);
  assert.equal(second.source.buffer, audio.clips.get("b.ogg")); assert.equal(audio.customVoices.size, 1);
  audio.play("rare"); assert.equal(audio.customVoices.has("rare"), false);
  Math.random = () => .01; audio.play("rare"); assert.equal(audio.customVoices.has("rare"), true);
} finally { Math.random = oldRandom; }
assert.equal(ducks.at(-1), true);
time += SFX_RULES.duckSeconds + .01; audio.updateDuck(); assert.equal(ducks.at(-1), false);
audio.preferences.setVolume("effects", .5, false); assert.equal(audio.master.value, .14);
time += .1; audio.play("absent", "impact"); assert.ok(audio.voices.size > audio.customVoices.size, "failed clips use synth");
audio.setPaused(true); assert.equal(audio.voices.size, 0); assert.equal(audio.customVoices.size, 0); assert.equal(audio.ducked, false);
audio.setPaused(false); audio.preferences.setMuted(true); audio.play("crash"); assert.equal(audio.voices.size, 0);
audio.preferences.setMuted(false); audio.play("crash"); assert.equal(audio.customVoices.size, 1);
audio.resetAttempt(); assert.equal(audio.customVoices.size, 0); assert.equal(audio.ducked, false);
audio.preferences.setVolume("effects", 0, false); audio.play("crash"); assert.equal(audio.voices.size, 0);
audio.destroy(); assert.equal(audio.clips.size, 0);
const empty = new SynthAudio(null, env, {}); env.dispatchEvent(new Event("pointerdown")); await empty.loadingPack;
assert.equal(fetched.length, 5, "empty default pack makes no requests"); empty.play("crash", "impact"); assert.ok(empty.voices.size); empty.destroy();
const ui = Object.assign(Object.create(UI.prototype), { commentary: { textContent: "old line" }, commentator: {} });
ui.setCommentaryDucked(true); ui.say("new line"); assert.equal(ui.commentary.textContent, "old line");
ui.setCommentaryDucked(false); assert.equal(ui.commentary.textContent, "new line");
const music = new MusicPlayer({ subscribe: () => () => {} });
music.setDuck(.72); music.setEffectsDuck(.35); assert.equal(music.duck, .72);
music.setEffectsDuck(1); assert.equal(music.duck, .72, "SFX release preserves Sync ducking"); music.destroy();
console.log("PASS Custom SFX: gesture loading, variants, rarity, fallback, volume, same-event replacement, ducking, pause/mute, reset and disposal");

runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
const cues = [], observer = Object.assign(Object.create(Presentation.prototype), {
  root: { dataset: {} }, audio: { play: (event, fallback) => cues.push([event, fallback]), resetAttempt() {} },
  effects: { clear() {}, burst() {}, shake() {}, victory() {} }, music: { setTrack() {} }, musicDirector: { scene() {} },
});
const world = new PhysicsWorld(CHARACTERS[0]); observer.replaceWorld(world);
for (let i = 0; i < 2500 && !world.finished; i++) { world.step(chapterControls(world, { id: "orientation-day" })); observer.observe(world); world.drainEvents(); }
for (const event of ["perfectPush", "perfectTakeoff", "syncReady", "onFireStreak"]) assert.ok(cues.some(c => c[0] === event), event);
assert.equal(cues.filter(c => c[0] === "perfectPush").length, world.skills.pushes.Perfect);
assert.ok(cues.filter(c => c[0] === "perfectPush").every(c => c[1] === "skill-perfect"));
// Observer-only fixtures for rare milestones; never feed fabricated facts to scoring.
world.tricks.forward = 2; world.tricks.bestCombo = 1.25; world.landed = true; world.crashed = false;
observer.observe(world);
world.crashed = true; world.crashClassification = "head-impact"; world.events.push("wrateWarning");
world.damage.lostParts.add("front-wheel"); observer.headFirst = true;
observer.soundEvents.delete("landingBanked");
observer.observe(world); observer.observe(world);
for (const event of ["flip1", "flip2", "crashLight", "headImpact", "partLoss", "syncMiss", "wrateWarning"]) assert.equal(cues.filter(c => c[0] === event).length, 1, event);
for (const state of ["campaign-upgrades", "ready", "attempt-results", "scoreboard", "final-results"]) {
  observer.state({ state, chaos: true, lastMedal: { upgraded: true }, lastEliminated: "p1" });
  observer.state({ state, chaos: true, lastMedal: { upgraded: true }, lastEliminated: "p1" });
}
for (const event of ["upgradeScreen", "chaosRoll", "medal", "elimination", "finalResults"]) assert.equal(cues.filter(c => c[0] === event).length, 1, event);
world.dispose();
console.log("PASS SFX hooks: real run-up, launch, distance and one-shot crash/trick/menu milestones");

for (let parts = 0; parts <= 4; parts++) for (const ejected of [false, true]) {
  const w = { damage: { lostParts: new Set(Array.from({length:parts},(_,i)=>i)), ejected } };
  assert.equal(crashSound(w), parts === 4 && ejected ? "crashMax" : parts >= 3 ? "crashHeavy" : parts === 2 ? "crashMedium" : "crashLight");
}
const landing = { skills: { brace: "Perfect Brace" }, syncSoundStep: 6 };
const score = { crashed: false, landingQuality: "Clean", tricks: { unique: 3 }, distanceMetres: 71 };
assert.deepEqual(landingSounds(landing, score), ["syncCombo5", "landPerfect", "crowdCheer"]);
landing.syncSoundStep = 3; landing.skills.brace = "Good Brace";
assert.deepEqual(landingSounds(landing, score), ["syncCombo3", "landClean", "crowdCheer"]);
landing.syncSoundStep = 0; assert.deepEqual(landingSounds(landing, score), ["trickCombo", "landClean", "crowdCheer"]);
assert.deepEqual(landingSounds(landing, {...score, crashed:true}), []);
const seq = new SyncSequence("jake"), sw = {}, sounds = [], play = event => sounds.push(event);
for (const note of seq.notes) {
  while(seq.time < note.at) seq.tick(Math.min(1/120, note.at-seq.time));
  seq.hit(note.lane); syncSounds(seq, sw, play); syncSounds(seq, sw, play);
}
while(seq.time <= seq.end + .01) seq.tick(1/120);
syncSounds(seq, sw, play); assert.deepEqual(sounds, ["syncStep1","syncStep2","syncStep3","syncStep6"]); assert.equal(sw.syncSoundStep,6);
const missed = new SyncSequence("jake"), mw={syncSoundStep:3}, misses=[];
while(missed.time <= missed.notes[0].at + missed.goodWindow + .2) missed.tick(1/120);
syncSounds(missed,mw,event=>misses.push(event)); assert.deepEqual(misses,["syncMiss"]); assert.equal(mw.syncSoundStep,0);
assert.equal(SFX_CONFIG.carnageExplosion.rarity,15);
for(const config of Object.values(SFX_CONFIG)) for(const file of config.files) {
  assert.ok(file.endsWith(".mp3") && file === file.toLowerCase());
  assert.ok(readFileSync(new URL("../assets/audio/sfx/"+file,import.meta.url)).length > 100);
}
const saved = new Map([[RECORDS_SAVE_KEY, JSON.stringify({version:1, levels:{jake:{"orientation-day":{points:100,metres:10}}}})]]);
const storage = {getItem:key=>saved.get(key),setItem:(key,v)=>saved.set(key,v)};
const records = new Records(storage); assert.equal(records.levelBest("jake","orientation-day").points,100);
assert.equal(records.submitEvent("jake","bowling",10),false); assert.equal(records.submitEvent("jake","bowling",10),false);
assert.equal(records.submitEvent("jake","bowling",20),true);
assert.equal(new Records(storage).submitEvent("jake","bowling",15),false);
assert.equal(new Records(storage).levelBest("jake","orientation-day").points,100);
console.log("PASS Pack assets, mutually exclusive tiers/landings/combos, note ladder/misses, and compatible persistent event bests");
