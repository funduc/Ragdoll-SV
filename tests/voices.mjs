import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { CharacterVoices } from "../js/voices.js";
import { VOICE_CONFIG } from "../js/voice-config.js";
import { AudioPreferences, AudioControls, AUDIO_SETTINGS_KEY } from "../js/audio-preferences.js";
import { SynthAudio } from "../js/audio.js";
import { audioDouble } from "./fake-audio.mjs";
import { PhysicsWorld } from "../js/physics.js";
import { CHARACTERS } from "../js/characters.js";
import { crashInputs, timedInputs } from "./skill-helpers.mjs";
import { Presentation } from "../js/presentation.js";
let time = 0;
class Context extends audioDouble(() => time) { async decodeAudioData() { return { duration: 2 }; } }
const stored = new Map([[AUDIO_SETTINGS_KEY, JSON.stringify({version:1,music:.3,effects:.6})]]);
const env = new EventTarget();
env.AudioContext = Context;
env.localStorage = {getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};
const urls = [];
env.fetch = async url => { urls.push(String(url)); return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}; };
const audio = new SynthAudio(null, env, {}), voices = new CharacterVoices(audio, VOICE_CONFIG, () => .5);
const voiceFacts = [];
voices.onPlayed = facts => voiceFacts.push(facts);
assert.equal(audio.preferences.voices, true, "old settings default to voices on");
assert.equal(urls.length, 0, "no loads before a gesture");
env.dispatchEvent(new Event("pointerdown")); await audio.loadingPack;
assert.equal(urls.length, 13);
assert.ok(!VOICE_CONFIG.brandon.some(clip => clip.file === "heckle-1.mp3" && clip.moments.includes("heckle"))); assert.ok(urls.every(url=>url.includes("/assets/audio/voice/")));
for (const [id, clips] of Object.entries(VOICE_CONFIG)) for (const clip of clips) {
  assert.ok(readFileSync(new URL("../assets/audio/voice/"+id+"/"+clip.file,import.meta.url)).length > 100);
}
function end() { time += 3; audio.context.tick(); voices.tick(); }
const played = [], actualPlay = audio.play.bind(audio), ducks = [], speaking = [];
audio.play = (...args) => { const result = actualPlay(...args); if(result) played.push(args[0]); return result; };
audio.onDuck = value => ducks.push(value); audio.onVoiceChange = value => speaking.push(value);
voices.party = ["jake", "owen"];
assert.equal(voices.request("jake", "crash-big"), true);
voices.heckle("jake"); voices.heckle("jake");
assert.equal(voices.queue.length, 1); assert.equal(voices.request("jake", "air"), false);
assert.deepEqual(played, ["voice:jake/crash-big-1.mp3"]);
assert.deepEqual(voiceFacts, [{ characterId: "jake", speakerId: "jake", heckle: false }]);
assert.equal(ducks.at(-1), true); assert.equal(speaking.at(-1), true);
end(); assert.equal(played.at(-1), "voice:owen/heckle-1.mp3", "Party prefers another player's character");
assert.deepEqual(voiceFacts.at(-1), { characterId: "jake", speakerId: "owen", heckle: true });
end(); assert.equal(speaking.at(-1), false); assert.equal(ducks.at(-1), false);
voices.reset(); assert.equal(voices.request("owen", "win"), false, "shared win/heckle clip cannot repeat");
assert.equal(voices.request("owen", "select"), false, "missing moment stays silent");
voices.request("brandon", "select", false); end();
assert.equal(voices.request("brandon", "rare"), false, "same clip across moments cannot repeat");
voices.request("jake", "air");
voices.heckle("jake");
audio.preferences.setVoices(false);
assert.equal(voices.queue.length, 0); assert.equal(audio.customVoices.has("characterVoice"), false);
assert.equal(new AudioPreferences(env).voices, false); assert.equal(new AudioPreferences(env).music, .3);
assert.equal(voices.request("jake", "lose", false), false);
audio.preferences.setVoices(true); voices.reset();
voices.request("jake", "lose"); voices.heckle("jake"); audio.setPaused(true); voices.tick();
assert.equal(voices.queue.length, 0); assert.equal(audio.voices.size, 0);
audio.setPaused(false); voices.reset();
audio.preferences.setMuted(true); assert.equal(voices.request("jake", "air"), false);
audio.preferences.setMuted(false); audio.preferences.setVolume("effects",0,false);
assert.equal(voices.request("jake", "air"), false); audio.preferences.setVolume("effects",.6,false);
// Saved toggle responds to pointer clicks; key events stay out of game controls.
const root = new EventTarget(), toggle = {textContent:"",setAttribute(k,v){this[k]=v;}};
root.querySelector = () => toggle; root.querySelectorAll = () => [];
const controls = new AudioControls(root,audio.preferences);
controls.click({target:{closest:()=>toggle}}); assert.equal(toggle.textContent,"Voices: Off");
let stopped = 0; controls.key({target:{matches:()=>true},stopPropagation(){stopped++;}}); assert.equal(stopped,1);
controls.click({target:{closest:()=>toggle}}); controls.destroy();
// Real crashes: one primary plus one different-character heckle, through Presentation.
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js",import.meta.url),"utf8"));
for (const character of CHARACTERS) {
  audio.resetAttempt(); voices.reset(); voices.party = CHARACTERS.map(c=>c.id);
  const world = new PhysicsWorld(character), first = played.length;
  const p = Object.assign(Object.create(Presentation.prototype), {
    audio, voices, effects:{clear(){},burst(){},shake(){}},
  });
  p.replaceWorld(world);
  for(let i=0;i<2500&&!world.finished;i++) {
    world.step(crashInputs(world)); time += 1/120; audio.context.tick();
    p.observe(world); voices.tick(); world.drainEvents();
  }
  end(); end();
  const jumpClips = played.slice(first).filter(c=>c.startsWith("voice:"));
  const heckles = jumpClips.filter(c=>c.includes("heckle-1"));
  assert.equal(heckles.length, character.id === "owen" ? 0 : 1);
  assert.ok(heckles.every(clip => !clip.startsWith("voice:"+character.id+"/")));
  assert.ok(jumpClips.filter(c=>!c.includes("heckle-1")).length<=1);
  world.dispose();
}
// Rare roll once, both sides of the 1-in-15 threshold; all landing outcomes eligible.
for (const random of [0, .5]) {
  audio.resetAttempt(); voices.reset(); voices.lastClip=null; voices.random=()=>random;
  const w = new PhysicsWorld(CHARACTERS[0]); w.landed=true;
  voices.observe(w); voices.observe(w);
  assert.equal(voices.used, random===0); w.dispose();
}
voices.random=()=>.5; audio.resetAttempt(); voices.reset(); voices.lastClip=null;
voices.finish({character:{id:"owen"}},{distanceMetres:70,landingQuality:"Clean",crashed:false},false);
assert.equal(played.at(-1),"voice:owen/best-1.mp3"); end();
voices.reset(); voices.finish({character:{id:"brandon"}},{distanceMetres:10,landingQuality:"Clean",crashed:false},false);
assert.equal(played.at(-1),"voice:brandon/land-clean-1.mp3"); end();
voices.reset(); voices.state({kind:"party",state:"ready",current:{id:"jake"},players:[]});
assert.equal(played.at(-1),"voice:jake/select-1.mp3"); end();
const winner={character:{id:"owen"}}, loser={character:{id:"jake"}};
voices.state({state:"final-results",players:[winner,loser],winners:[winner],standings:[{player:winner},{player:loser}]});
assert.equal(played.at(-1),"voice:owen/heckle-1.mp3"); end();
assert.equal(played.at(-1),"voice:jake/lose-1.mp3"); end();
audio.clips.clear(); voices.reset(); assert.equal(voices.request("jake","select",false),false);
voices.destroy(); audio.destroy();
console.log("PASS Character voices: assets, gesture loading, moment mappings, real cross-character crashes, limits, no repeats, rare odds, Party results, ducking, toggle/save compatibility and mute/pause/fallback");
