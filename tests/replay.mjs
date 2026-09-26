import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { ReplayRecording, ReplayPlayer, ReplayControls, REPLAY_MAX_FRAMES } from "../js/replay.js";
import { PhysicsWorld } from "../js/physics.js";
import { Renderer } from "../js/renderer.js";
import { Effects } from "../js/effects.js";
import { CHARACTERS } from "../js/characters.js";
import { LEVELS } from "../js/campaign-levels.js";
import { scoreAttempt } from "../js/scoring.js";
import { timedInputs } from "./skill-helpers.mjs";
runInThisContext(readFileSync(new URL("../vendor/matter-0.20.0.min.js", import.meta.url), "utf8"));
globalThis.window = new EventTarget(); window.devicePixelRatio = 1;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const calls = [];
const ctx = new Proxy({}, {
  get: (_, name) => (...args) => {
    calls.push([name, ...args]);
    if (name === "createLinearGradient") return { addColorStop(...stops) { calls.push(["addColorStop", ...stops]); } };
  },
  set: (_, name, value) => { calls.push([name, typeof value === "object" ? "gradient" : value]); return true; },
});
const renderer = new Renderer({ getContext: () => ctx, getBoundingClientRect: () => ({ width: 1200, height: 560 }) });
function drawing(world, effects, cosmetics) {
  calls.length = 0; renderer.cosmetics = cosmetics; renderer.resetCamera();
  renderer.draw(world, 1 / 60, effects);
  return JSON.stringify(calls);
}
let lastRecording, lastWorld;
for (const character of CHARACTERS) {
  const world = new PhysicsWorld(character, LEVELS.find(l => l.arena.cargo).arena, { condition: character.id === "jake" ? "boost-strip" : "icy-ramp", objective: "landing-zone" });
  const effects = new Effects();
  const recording = new ReplayRecording(world);
  const cosmetics = { cart: "#ff0000", arena: "#00ff00" };
  let comparisons = 0;
  for (let i = 0; i < 2500 && !world.finished; i++) {
    world.step(timedInputs(world, world.launched ? 1 : 0));
    recording.observe(world);
    if (world.landed && !effects.particles.length) effects.burst("dust", world.cart.position.x, 520, 8);
    effects.update(1 / 120);
    if (i % 2 === 0 || world.finished) {
      recording.capture(world, effects, cosmetics);
      if (i % 40 === 0 || world.finished) {
        const player = new ReplayPlayer(recording);
        player.time = world.elapsed;
        const sample = player.sample();
        assert.equal(drawing(sample.world, sample.effects, sample.cosmetics), drawing(world, effects, cosmetics), "recorded sample issues identical Canvas commands");
        assert.equal(sample.world.head, sample.world.rider[world.rider.indexOf(world.head)]);
        assert.notEqual(sample.world.cart, world.cart);
        assert.equal(sample.world.engine, undefined);
        comparisons++;
      }
    }
  }
  assert.ok(comparisons > 10 && recording.impactTime !== null);
  const score = scoreAttempt(world.metrics(), character);
  const before = JSON.stringify(world.metrics());
  const player = new ReplayPlayer(recording);
  player.time = (recording.crashTime ?? recording.impactTime);
  assert.equal(player.speed, 0.3);
  const t = player.time; player.advance(0.1); assert.ok(Math.abs(player.time - t - 0.03) < 1e-10);
  const reduced = new ReplayPlayer(recording, { reducedMotion: true });
  reduced.time = player.time; assert.equal(reduced.speed, 1);
  while (!player.done) { player.advance(1 / 60); player.sample(); }
  assert.equal(JSON.stringify(world.metrics()), before);
  assert.deepEqual(scoreAttempt(world.metrics(), character), score);
  assert.equal(recording.shouldAutoPlay({ crashed: true, distanceMetres: 0 }, false), true);
  assert.equal(recording.shouldAutoPlay({ crashed: false, distanceMetres: 55 }, false), false);
  assert.equal(recording.shouldAutoPlay({ crashed: false, distanceMetres: 55.1 }, false), true);
  assert.equal(recording.shouldAutoPlay(score, true), false);
  const saved = JSON.stringify(recording.frames[0]);
  world.cart.position.x += 999;
  assert.equal(JSON.stringify(recording.frames[0]), saved, "recording owns all mutable poses");
  if (lastWorld) lastWorld.dispose();
  lastWorld = world; lastRecording = recording;
}
console.log("PASS all characters: exact Canvas commands, every body/cargo, effects, detached poses, impact slow motion, reduced motion and unchanged scores");

const bounds = new ReplayRecording(lastWorld), effects = new Effects();
for (let i = 0; i < 5000; i++) {
  lastWorld.elapsed = i / 500;
  bounds.capture(lastWorld, effects, {});
}
assert.equal(bounds.frames.length, REPLAY_MAX_FRAMES);
lastWorld.elapsed = 31;
bounds.capture(lastWorld, effects, {});
assert.equal(bounds.frames.length, 1);
assert.equal(bounds.available, false);
console.log("PASS recording is bounded by both 20 seconds and frame count");

const source = readFileSync(new URL("../js/game.js", import.meta.url), "utf8");
const moduleSource = source.slice(0, source.lastIndexOf("\ntry {"))
  .replace(/from "(\.\/[^\"]+)"/g, (_, p) => `from "${new URL(p, new URL("../js/game.js", import.meta.url)).href}"`) + "\nexport { Game };";
const { Game } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);
const banner = { hidden: true, focus() {} };
globalThis.document = { hidden: false, getElementById: () => banner };
globalThis.requestAnimationFrame = () => 1;
for (const mode of ["vault", "party"]) {
  let renders = 0;
  const session = { state: "attempt-results", lastScore: { crashed: true, total: 1234 } };
  const game = Object.assign(Object.create(Game.prototype), {
    mode, campaign: session, tournament: session, recording: lastRecording,
    world: { step() { throw Error("replay advanced physics"); } },
    input: { downKeys: new Set() },
    clearControls() {},
    presentation: { audio: { stopAll() {} }, effects },
    ui: { overlay: {}, hud: {}, say() {} },
    renderer: { cosmetics: {}, resetCamera() {}, draw() {} },
    renderState() { renders++; },
  });
  game.startReplay(true);
  assert.ok(game.replayPlayer);
  const target = new EventTarget();
  const controls = new ReplayControls(target, () => !!game.replayPlayer, () => game.stopReplay(), game.input);
  let leaked = 0;
  for (const type of ["keydown", "pointerdown", "click"]) target.addEventListener(type, () => leaked++);
  for (const [type, code] of [["keydown", "KeyQ"], ["keydown", "Enter"], ["keydown", "Space"], ["keydown", "KeyR"], ["pointerdown", ""]]) {
    game.startReplay();
    game.frame(100); game.frame(116);
    const event = new Event(type, { cancelable: true }); Object.assign(event, { code });
    target.dispatchEvent(event);
    assert.equal(game.replayPlayer, null, "skip is synchronous");
    assert.ok(event.defaultPrevented);
    target.dispatchEvent(new Event("click", { cancelable: true }));
    assert.equal(leaked, 0, "skip cannot click through to results");
    assert.equal(session.state, "attempt-results"); assert.equal(session.lastScore.total, 1234);
  }
  game.startReplay(); game.replayPlayer.time = game.replayPlayer.end;
  game.frame(132); assert.equal(game.replayPlayer, null);
  assert.equal(renders, 6);
  controls.destroy();
  target.dispatchEvent(new Event("keydown")); assert.equal(leaked, 1);
}
lastWorld.dispose(); renderer.destroy();
console.log("PASS Vault and Party playback use no physics, return to results once, and consume keyboard/tap skips without click-through; listeners disposed");
import { Campaign } from "../js/campaign.js";
import { CampaignSave } from "../js/campaign-save.js";
import { Tournament, State } from "../js/tournament.js";

for (const mode of ["party", "vault"]) {
  const world = new PhysicsWorld(CHARACTERS[0]);
  const recording = new ReplayRecording(world);
  const effects = new Effects();
  for (let i = 0; i < 2500 && !world.finished; i++) {
    world.step(timedInputs(world, world.launched ? 1 : 0));
    recording.observe(world);
    recording.capture(world, effects, {});
  }
  assert.ok(world.finished && world.crashed, "real crash triggers automatic replay");
  const entries = new Map();
  const storage = { getItem: k => entries.get(k) ?? null, setItem: (k, v) => entries.set(k, v) };
  const campaign = new Campaign(new CampaignSave(storage), { seedFactory: () => 42 });
  campaign.select("jake"); campaign.confirm(); campaign.startLevel("orientation-day"); campaign.confirm();
  const tournament = new Tournament(); tournament.state = State.ACTIVE;
  let physicsCalls = 0, notices = 0, recorded = 0;
  // The real attempt has finished; the next game frame must bank it exactly once.
  world.step = () => { physicsCalls++; };
  const session = mode === "vault" ? campaign : tournament;
  const originalRecord = session.record.bind(session);
  session.record = (...args) => { recorded++; return originalRecord(...args); };
  const game = Object.assign(Object.create(Game.prototype), {
    mode, campaign, tournament, world, recording,
    lastTime: 0, accumulator: 0, suspended: false,
    introduction: { active: false }, biographyReader: { tick() {} },
    input: { consume: () => ({ pushes: 0, rotate: 0, brace: false }) },
    touch: { merge: value => value, sync() {} },
    clearControls() {}, achievements: { send() {} },
    syncSave: { data: { occurrences: [] }, finish() {} },
    presentation: { observe() {}, frame() {}, state() {}, effects, audio: { stopAll() {} } },
    renderer: { cosmetics: {}, resetCamera() {}, draw() {} },
    ui: { render() {}, overlay: {}, hud: {}, observeAttempt() {}, say() {} },
    showAchievementsAfterAttempt() { notices++; },
    renderState() { this.showAchievementsAfterAttempt(); },
  });
  game.frame(16);
  assert.ok(game.replayPlayer, `${mode} crash automatically starts playback`);
  assert.equal(recorded, 1); assert.equal(notices, 0, "notices wait for visible results");
  const saved = JSON.stringify([...entries]);
  for (let time = 32; time < 100000 && game.replayPlayer; time += 16) game.frame(time);
  assert.equal(game.replayPlayer, null);
  assert.equal(physicsCalls, 1); assert.equal(recorded, 1); assert.equal(notices, 1);
  assert.equal(JSON.stringify([...entries]), saved);
  assert.equal(session.state, State.RESULTS);
  world.dispose();
}
console.log("PASS real crash automatically replays once in both modes; scores bank once, saves stay unchanged, and achievement notices wait for results");
