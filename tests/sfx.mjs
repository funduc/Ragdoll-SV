import { timedInputs } from "./skill-helpers.mjs";
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

// Keep the real Presentation.onDuck wiring: a mocked callback missed the
// missing config import that permanently disabled effects on the first big cue.
const originalContext = globalThis.AudioContext;
globalThis.AudioContext = Context;
try {
  const presentation = new Presentation({ dataset: {} }, null);
  const captions = [];
  presentation.onCommentaryDuck = value => captions.push(value);
  presentation.audio.unlock();
  presentation.audio.clips.set("combo3.mp3", { duration: 3 });
  presentation.audio.clips.set("menu-confirm.mp3", { duration: 1 });
  for (let attempt = 0; attempt < 5; attempt++) {
    presentation.replaceWorld({});
    presentation.audio.play("syncCombo3");
    assert.equal(presentation.audio.failed, false, "ducking must never disable later effects");
    assert.equal(presentation.audio.customVoices.size, 1);
    assert.equal(presentation.music.effectsDuck, SFX_RULES.musicDuck);
    assert.equal(captions.at(-1), true);
    time += SFX_RULES.duckSeconds + .01;
    presentation.frame({ invalid: true }, false, false, .01, 16);
    assert.equal(presentation.music.effectsDuck, 1);
    assert.equal(captions.at(-1), false);
    presentation.audio.resetAttempt();
    presentation.audio.play("menuConfirm", "click");
    assert.equal(presentation.audio.customVoices.size, 1, "next-level cues still play");
    assert.equal(presentation.audio.failed, false);
  }
  presentation.destroy();
} finally {
  if (originalContext === undefined) delete globalThis.AudioContext;
  else globalThis.AudioContext = originalContext;
}
console.log("PASS Real presentation ducking restores music/captions and keeps SFX alive across five attempts");

for (const character of CHARACTERS) {
  const w = new PhysicsWorld(character), played = [];
  const p = Object.assign(Object.create(Presentation.prototype), {
    audio: { play(event) { played.push({ event, time: w.elapsed, finished: w.finished }); }, resetAttempt() {} },
    effects: { clear() {}, burst() {}, shake() {} },
  });
  p.replaceWorld(w);
  let impactTime, impactTier;
  for (let i = 0; i < 2500 && !w.finished; i++) {
    w.step(timedInputs(w, w.launched ? 1 : 0));
    const firstCrash = w.crashed && impactTime === undefined;
    if (firstCrash) { impactTime = w.elapsed; impactTier = crashSound(w); }
    p.observe(w);
    if (firstCrash) {
      const cue = played.find(item => item.event === impactTier);
      assert.ok(cue, character.id + ": crash cue is emitted on the impact step");
      assert.equal(cue.time, impactTime); assert.equal(cue.finished, false);
      assert.ok(w.damage.lostParts.size > 0, "tier sees breakage from this impact");
    }
    w.drainEvents();
  }
  assert.ok(w.finished && impactTime !== undefined);
  p.observe(w); // repeated result frames must remain silent for crash tiers
  const tiers = played.filter(item => ["crashLight", "crashMedium", "crashHeavy", "crashMax"].includes(item.event));
  assert.deepEqual(tiers.map(item => item.event), [impactTier]);
  assert.ok(w.elapsed > impactTime, "the cue precedes settling/results");
  const explosions = played.filter(item => item.event === "carnageExplosion");
  assert.equal(explosions.length, ["crashHeavy", "crashMax"].includes(impactTier) ? 1 : 0);
  assert.ok(explosions.every(item => item.time === impactTime));
  w.dispose();
}
console.log("PASS All characters: crash tier and explosion fire on the impact step, once, before settling/results");

// Exercise the observer through the real audio player, including pitched clip lifetimes.
const pitched = new SynthAudio(null, env);
pitched.unlock();
pitched.clips.set("push.mp3", { duration: .08 });
pitched.clips.set("bam1.mp3", { duration: .3 });
pitched.clips.set("menu-confirm.mp3", { duration: 1 });
const pushWorld = new PhysicsWorld(CHARACTERS[0]);
const pushObserver = Object.assign(Object.create(Presentation.prototype), {
  audio: pitched, effects: { clear() {}, burst() {}, shake() {} },
});
pushObserver.replaceWorld(pushWorld);
const pushCues = [], actualPlay = pitched.play.bind(pitched);
pitched.play = (event, ...args) => { pushCues.push(event); actualPlay(event, ...args); };
let serial = 0;
function feedback(grade, kind = "push") {
  time += .5; pitched.context.tick();
  if (kind === "push") pushWorld.skills.pushes[grade]++;
  pushWorld.skills.feedback = { serial: ++serial, kind, grade };
  pushObserver.observe(pushWorld);
  pushObserver.observe(pushWorld); // repeated frames must not advance pitch or replay stings
}
for (let i = 0; i < 9; i++) {
  feedback("Perfect");
  const source = pitched.customVoices.get("push").source;
  const expected = 2 ** (Math.min(i, 6) / 12);
  assert.equal(source.playbackRate.value, expected);
  assert.ok(Math.abs(source.stopTime - time - .08 / expected) < 1e-10);
  assert.equal(pushCues.filter(c => c === "syncReady").length, i >= 4 ? 1 : 0);
}
feedback("Good"); assert.equal(pitched.customVoices.get("push").source.playbackRate.value, 1);
feedback("Perfect"); assert.equal(pitched.customVoices.get("push").source.playbackRate.value, 1);
const beforeMiss = pushCues.length;
feedback("Miss"); assert.equal(pushCues.length, beforeMiss, "a Miss emits no sound");
assert.equal(pitched.customVoices.has("push"), false);
feedback("Perfect"); assert.equal(pitched.customVoices.get("push").source.playbackRate.value, 1);
const beforeTakeoff = pushCues.length;
feedback("Perfect", "takeoff"); assert.deepEqual(pushCues.slice(beforeTakeoff), ["perfectTakeoff"]);
assert.equal(pushCues.filter(c => c === "syncReady").length, 1);
assert.ok(!pushCues.some(c => /^syncStep/.test(c)), "pushes never use the Sync ladder");
assert.equal(pitched.failed, false);
const randomBeforePitch = Math.random;
try {
  for (const random of [0, .5, .999]) {
    Math.random = () => random;
    pitched.play("menuConfirm", "click");
    const source = pitched.customVoices.get("menuConfirm").source;
    const rate = 1 + (random * 2 - 1) * .05;
    assert.equal(source.playbackRate.value, rate);
    assert.ok(Math.abs(source.stopTime - time - 1 / rate) < 1e-10, "low pitches must not truncate the clip");
  }
} finally { Math.random = randomBeforePitch; }
pushObserver.replaceWorld(pushWorld);
assert.equal(pushObserver.perfectStreak, 0);
pitched.clips.clear();
feedback("Good"); assert.ok(pitched.voices.size > 0, "missing push retains Good synth");
feedback("Perfect"); assert.ok(pitched.voices.size > 0, "missing push retains Perfect synth");
time += 1; pitched.context.tick(); pitched.play("menuConfirm", "click");
assert.ok(pitched.voices.size > 0, "missing menu clip retains click synth");
assert.equal(pitched.failed, false);
pitched.preferences.setMuted(true); feedback("Perfect"); assert.equal(pitched.voices.size, 0);
pitched.destroy(); pushWorld.dispose();
console.log("PASS Push pitch ladder/cap/reset, silent Miss, fifth-push sting, unchanged takeoff, menu pitch/lifetimes, fallback and mute");
